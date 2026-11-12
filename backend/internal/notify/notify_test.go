package notify

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net"
	"net/http"
	"net/http/httptest"
	"net/mail"
	"strconv"
	"strings"
	"sync"
	"testing"

	"chrismoore-decor/backend/internal/models"
)

func sampleUpdate(event string) Update {
	return Update{
		Event:    event,
		OrderURL: "https://shop.test/order/CM-AB12CD34",
		Store:    StoreInfo{Name: "Chris Moore Interior Decor", Phone: "0703 963 0895", WhatsApp: "2347039630895"},
		Order: models.Order{
			ID: "o1", Reference: "CM-AB12CD34", CustomerName: "Ada <b>Obi</b>", Email: "ada@example.com", Phone: "0803 123 4567",
			Address: "1 Allen Ave", City: "Ikeja", State: "Lagos", Channel: "whatsapp", PaymentStatus: "unpaid",
			Subtotal: 8500000, ShippingFee: 500000, Total: 9000000,
			Items: []models.OrderItem{{ProductName: "Sahara Curtains", Quantity: 1, UnitPrice: 8500000, Color: "Sand", Size: "140 x 230 cm"}},
		},
	}
}

func TestSentencesAreSingleLine(t *testing.T) {
	for _, ev := range Events {
		for _, ch := range []string{"whatsapp", "paystack"} {
			u := sampleUpdate(ev)
			u.Order.Channel = ch
			s := u.Sentence()
			if s == "" || strings.ContainsAny(s, "\n\t₦") {
				t.Errorf("%s/%s sentence %q must be one plain line", ev, ch, s)
			}
		}
	}
	u := sampleUpdate(EventPlaced)
	u.Order.Channel = "paystack"
	if !strings.Contains(u.Sentence(), "3 hours") {
		t.Errorf("unpaid online order should mention the payment window: %q", u.Sentence())
	}
	if StatusEvent("processing") != "" || StatusEvent("pending") != "" || StatusEvent("shipped") != EventShipped {
		t.Error("StatusEvent mapping is wrong")
	}
}

func TestSMSText(t *testing.T) {
	msg := SMSText(sampleUpdate(EventShipped))
	want := "Chris Moore Decor: Hi Ada, your order is on its way to you. Order CM-AB12CD34. Track it: https://shop.test/order/CM-AB12CD34"
	if msg != want {
		t.Fatalf("SMS text:\n got %q\nwant %q", msg, want)
	}
	if len(msg) > 160 {
		t.Errorf("shipped SMS should fit in one part, got %d chars", len(msg))
	}
}

func TestTermiiSend(t *testing.T) {
	var got map[string]string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/sms/send" || r.Method != http.MethodPost {
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
		_ = json.NewDecoder(r.Body).Decode(&got)
		_, _ = io.WriteString(w, `{"code":"ok","message_id":"3017","message":"Successfully Sent"}`)
	}))
	defer srv.Close()
	tm := Termii{APIKey: "key", SenderID: "ChrisMoore", BaseURL: srv.URL}
	u := sampleUpdate(EventPaid)
	to := tm.Recipient(u.Order)
	if to != "2348031234567" {
		t.Fatalf("recipient = %q", to)
	}
	if err := tm.Send(context.Background(), to, u); err != nil {
		t.Fatal(err)
	}
	if got["to"] != "2348031234567" || got["from"] != "ChrisMoore" || got["api_key"] != "key" || got["channel"] != "dnd" {
		t.Errorf("bad payload: %v", got)
	}
	if !strings.Contains(got["sms"], "NGN 90,000") {
		t.Errorf("sms should include the amount: %q", got["sms"])
	}
}

func TestTermiiError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = io.WriteString(w, `{"message":"Insufficient balance"}`)
	}))
	defer srv.Close()
	err := Termii{APIKey: "k", SenderID: "S", BaseURL: srv.URL}.Send(context.Background(), "234", sampleUpdate(EventPaid))
	if err == nil || !strings.Contains(err.Error(), "Insufficient balance") {
		t.Fatalf("want provider error, got %v", err)
	}
}

func TestWhatsAppTemplateSend(t *testing.T) {
	var body struct {
		To       string `json:"to"`
		Type     string `json:"type"`
		Template struct {
			Name       string            `json:"name"`
			Language   map[string]string `json:"language"`
			Components []struct {
				Type       string `json:"type"`
				Parameters []struct {
					Text string `json:"text"`
				} `json:"parameters"`
			} `json:"components"`
		} `json:"template"`
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/PNID/messages" || r.Header.Get("Authorization") != "Bearer tok" {
			t.Errorf("unexpected request %s auth=%q", r.URL.Path, r.Header.Get("Authorization"))
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		_, _ = io.WriteString(w, `{"messages":[{"id":"wamid.1"}]}`)
	}))
	defer srv.Close()
	wa := WhatsAppTemplate{Token: "tok", PhoneNumberID: "PNID", Template: "order_update", BaseURL: srv.URL}
	if err := wa.Send(context.Background(), "2348031234567", sampleUpdate(EventDelivered)); err != nil {
		t.Fatal(err)
	}
	if body.Type != "template" || body.Template.Name != "order_update" || body.Template.Language["code"] != "en" {
		t.Fatalf("bad template payload: %+v", body)
	}
	p := body.Template.Components[0].Parameters
	if len(p) != 4 || p[0].Text != "Ada" || p[2].Text != "CM-AB12CD34" || p[3].Text != "https://shop.test/order/CM-AB12CD34" {
		t.Fatalf("bad parameters: %+v", p)
	}

	srv2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = io.WriteString(w, `{"error":{"message":"Template name does not exist in the translation"}}`)
	}))
	defer srv2.Close()
	wa.BaseURL = srv2.URL
	if err := wa.Send(context.Background(), "234", sampleUpdate(EventPaid)); err == nil || !strings.Contains(err.Error(), "does not exist") {
		t.Fatalf("want Meta error message, got %v", err)
	}
}

// decodeEmail parses a built message and returns its headers and parts.
func decodeEmail(t *testing.T, raw []byte) (*mail.Message, map[string]string) {
	t.Helper()
	m, err := mail.ReadMessage(strings.NewReader(string(raw)))
	if err != nil {
		t.Fatal(err)
	}
	_, params, err := mime.ParseMediaType(m.Header.Get("Content-Type"))
	if err != nil {
		t.Fatal(err)
	}
	parts := map[string]string{}
	mr := multipart.NewReader(m.Body, params["boundary"])
	for {
		p, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		b, _ := io.ReadAll(quotedprintable.NewReader(p))
		ct, _, _ := mime.ParseMediaType(p.Header.Get("Content-Type"))
		parts[ct] = string(b)
	}
	return m, parts
}

func TestBuildEmail(t *testing.T) {
	u := sampleUpdate(EventPlaced)
	from, _ := mail.ParseAddress("Chris Moore Interior Decor <orders@shop.test>")
	raw, err := BuildEmail(from, &mail.Address{Name: u.Order.CustomerName, Address: "ada@example.com"}, "hello@shop.test", u)
	if err != nil {
		t.Fatal(err)
	}
	m, parts := decodeEmail(t, raw)
	subject, _ := new(mime.WordDecoder).DecodeHeader(m.Header.Get("Subject"))
	if subject != "We've received your order · CM-AB12CD34" {
		t.Errorf("subject = %q", subject)
	}
	if m.Header.Get("Reply-To") != "<hello@shop.test>" {
		t.Errorf("reply-to = %q", m.Header.Get("Reply-To"))
	}
	html, text := parts["text/html"], parts["text/plain"]
	for _, want := range []string{"TRACK YOUR ORDER", "https://shop.test/order/CM-AB12CD34", "Sahara Curtains", "Sand, 140 x 230 cm", "₦90,000", "Ikeja, Lagos"} {
		if !strings.Contains(html, want) {
			t.Errorf("html missing %q", want)
		}
	}
	if strings.Contains(html, "<b>Obi</b>") || strings.Contains(html, "Ada <b>") {
		t.Error("customer-entered text must be HTML-escaped")
	}
	for _, want := range []string{"Hi Ada,", "Track your order: https://shop.test/order/CM-AB12CD34", "Total: ₦90,000"} {
		if !strings.Contains(text, want) {
			t.Errorf("text missing %q:\n%s", want, text)
		}
	}
}

// fakeSMTP accepts one plain (no TLS, no auth) SMTP session.
func fakeSMTP(t *testing.T) (port int, got chan string) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ln.Close() })
	got = make(chan string, 1)
	go func() {
		c, err := ln.Accept()
		if err != nil {
			return
		}
		defer c.Close()
		r := bufio.NewReader(c)
		say := func(s string) { _, _ = io.WriteString(c, s+"\r\n") }
		say("220 fake ESMTP")
		var log strings.Builder
		inData := false
		for {
			line, err := r.ReadString('\n')
			if err != nil {
				return
			}
			if inData {
				if line == ".\r\n" {
					inData = false
					say("250 queued")
					continue
				}
				log.WriteString(line)
				continue
			}
			cmd := strings.ToUpper(strings.TrimSpace(line))
			log.WriteString(cmd + "\n")
			switch {
			case strings.HasPrefix(cmd, "EHLO"):
				say("250-fake")
				say("250 8BITMIME")
			case strings.HasPrefix(cmd, "MAIL"), strings.HasPrefix(cmd, "RCPT"):
				say("250 ok")
			case cmd == "DATA":
				inData = true
				say("354 go ahead")
			case cmd == "QUIT":
				say("221 bye")
				got <- log.String()
				return
			default:
				say("250 ok")
			}
		}
	}()
	return ln.Addr().(*net.TCPAddr).Port, got
}

func TestSMTPSend(t *testing.T) {
	port, got := fakeSMTP(t)
	s := SMTP{Host: "127.0.0.1", Port: port, From: "Chris Moore Interior Decor <orders@shop.test>"}
	u := sampleUpdate(EventConfirmed)
	if to := s.Recipient(u.Order); to != "ada@example.com" {
		t.Fatalf("recipient = %q", to)
	}
	if err := s.Send(context.Background(), "ada@example.com", u); err != nil {
		t.Fatal(err)
	}
	session := <-got
	for _, want := range []string{"MAIL FROM:<ORDERS@SHOP.TEST>", "RCPT TO:<ADA@EXAMPLE.COM>", "Subject: ", "multipart/alternative"} {
		if !strings.Contains(session, want) {
			t.Errorf("SMTP session missing %q:\n%s", want, session)
		}
	}
}

func TestSMTPRefusesPasswordWithoutTLS(t *testing.T) {
	port, _ := fakeSMTP(t)
	s := SMTP{Host: "127.0.0.1", Port: port, From: "orders@shop.test", Username: "u", Password: "p"}
	err := s.Send(context.Background(), "ada@example.com", sampleUpdate(EventPaid))
	if err == nil || !strings.Contains(err.Error(), "STARTTLS") {
		t.Fatalf("want STARTTLS refusal, got %v", err)
	}
}

// memRecorder is an in-memory Recorder with the same once-per-key rule as
// the order_notifications table.
type memRecorder struct {
	mu     sync.Mutex
	rows   map[string]string // key -> status
	nextID int
	ids    map[string]string // id -> key
}

func (m *memRecorder) ClaimNotification(_ context.Context, orderID, event, channel, _ string, force bool) (string, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := orderID + "/" + event + "/" + channel
	if st, ok := m.rows[key]; ok && (!force || st == "sending") {
		return "", false, nil
	}
	m.nextID++
	id := strconv.Itoa(m.nextID)
	m.rows[key], m.ids[id] = "sending", key
	return id, true, nil
}

func (m *memRecorder) FinishNotification(_ context.Context, id string, err error) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	st := "sent"
	if err != nil {
		st = "failed"
	}
	m.rows[m.ids[id]] = st
	return nil
}

type fakeChannel struct {
	name    string
	enabled bool
	fail    bool
	mu      sync.Mutex
	sent    []string
}

func (f *fakeChannel) Name() string                    { return f.name }
func (f *fakeChannel) Enabled() bool                   { return f.enabled }
func (f *fakeChannel) Recipient(o models.Order) string { return o.Phone }
func (f *fakeChannel) Send(_ context.Context, to string, u Update) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, u.Event+":"+to)
	if f.fail {
		return errors.New("boom")
	}
	return nil
}

func TestServiceSendsOncePerEvent(t *testing.T) {
	rec := &memRecorder{rows: map[string]string{}, ids: map[string]string{}}
	sms := &fakeChannel{name: "sms", enabled: true}
	mail := &fakeChannel{name: "email", enabled: true, fail: true}
	off := &fakeChannel{name: "whatsapp"}
	svc := &Service{Recorder: rec, Channels: []Channel{sms, mail, off}, OrderURL: func(r string) string { return "https://x/" + r }}

	if got := svc.Active(); len(got) != 2 || !svc.Has("sms") || svc.Has("whatsapp") {
		t.Fatalf("active channels = %v", got)
	}
	o := sampleUpdate("").Order
	// The callback and the webhook both confirm a payment at the same time.
	var wg sync.WaitGroup
	for range 5 {
		wg.Add(1)
		go func() { defer wg.Done(); svc.Send(context.Background(), o, EventPaid, false) }()
	}
	wg.Wait()
	svc.Notify(o, EventShipped)
	svc.Notify(o, "") // no-op
	svc.Wait(5e9)

	if len(sms.sent) != 2 || len(off.sent) != 0 {
		t.Fatalf("sms sent %v, disabled channel sent %v", sms.sent, off.sent)
	}
	if rec.rows["o1/paid/email"] != "failed" || rec.rows["o1/paid/sms"] != "sent" {
		t.Fatalf("recorded statuses: %v", rec.rows)
	}
	// A manual resend goes out again.
	svc.Send(context.Background(), o, EventPaid, true)
	if len(sms.sent) != 3 || len(mail.sent) != 3 {
		t.Fatalf("resend: sms %v, email %v", sms.sent, mail.sent)
	}
}
