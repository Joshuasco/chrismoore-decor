package notify

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"errors"
	"fmt"
	"html/template"
	"mime"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"chrismoore-decor/backend/internal/models"
	"chrismoore-decor/backend/internal/whatsapp"
)

// SMTP sends email through any SMTP service (Brevo, Resend, Zoho, Gmail with
// an app password, Amazon SES…). Port 465 uses implicit TLS; other ports
// upgrade with STARTTLS when the server offers it.
type SMTP struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string // "Chris Moore Interior Decor <orders@example.com>"
	ReplyTo  string
}

func (s SMTP) Name() string  { return "email" }
func (s SMTP) Enabled() bool { return s.Host != "" && s.From != "" }

func (s SMTP) Recipient(o models.Order) string {
	a, err := mail.ParseAddress(o.Email)
	if err != nil {
		return ""
	}
	return a.Address
}

func (s SMTP) Send(ctx context.Context, to string, u Update) error {
	from, err := mail.ParseAddress(s.From)
	if err != nil {
		return fmt.Errorf("email: invalid EMAIL_FROM: %w", err)
	}
	msg, err := BuildEmail(from, &mail.Address{Name: u.Order.CustomerName, Address: to}, s.ReplyTo, u)
	if err != nil {
		return err
	}
	return s.deliver(ctx, from.Address, to, msg)
}

func (s SMTP) deliver(ctx context.Context, from, to string, msg []byte) error {
	port := s.Port
	if port == 0 {
		port = 587
	}
	addr := net.JoinHostPort(s.Host, strconv.Itoa(port))
	tlsCfg := &tls.Config{ServerName: s.Host, MinVersion: tls.VersionTLS12}
	dialer := &net.Dialer{Timeout: 15 * time.Second}

	var conn net.Conn
	var err error
	if port == 465 {
		conn, err = (&tls.Dialer{NetDialer: dialer, Config: tlsCfg}).DialContext(ctx, "tcp", addr)
	} else {
		conn, err = dialer.DialContext(ctx, "tcp", addr)
	}
	if err != nil {
		return fmt.Errorf("email: connect %s: %w", addr, err)
	}
	deadline := time.Now().Add(30 * time.Second)
	if d, ok := ctx.Deadline(); ok && d.Before(deadline) {
		deadline = d
	}
	_ = conn.SetDeadline(deadline)

	c, err := smtp.NewClient(conn, s.Host)
	if err != nil {
		conn.Close()
		return fmt.Errorf("email: %w", err)
	}
	defer c.Close()

	if port != 465 {
		if ok, _ := c.Extension("STARTTLS"); ok {
			if err := c.StartTLS(tlsCfg); err != nil {
				return fmt.Errorf("email: starttls: %w", err)
			}
		} else if s.Username != "" {
			// Never send a password over an unencrypted connection.
			return errors.New("email: server does not support STARTTLS; use port 465 or 587")
		}
	}
	if s.Username != "" {
		if err := c.Auth(smtp.PlainAuth("", s.Username, s.Password, s.Host)); err != nil {
			return fmt.Errorf("email: login: %w", err)
		}
	}
	if err := c.Mail(from); err != nil {
		return fmt.Errorf("email: sender rejected: %w", err)
	}
	if err := c.Rcpt(to); err != nil {
		return fmt.Errorf("email: recipient rejected: %w", err)
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("email: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		return fmt.Errorf("email: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("email: message rejected: %w", err)
	}
	return c.Quit()
}

// BuildEmail renders a multipart (plain text + HTML) message.
func BuildEmail(from, to *mail.Address, replyTo string, u Update) ([]byte, error) {
	var html bytes.Buffer
	if err := emailTemplate.Execute(&html, emailData(u)); err != nil {
		return nil, fmt.Errorf("email: render: %w", err)
	}
	boundary := randomHex(12)
	domain := "localhost"
	if i := strings.LastIndex(from.Address, "@"); i >= 0 {
		domain = from.Address[i+1:]
	}

	var b bytes.Buffer
	h := func(k, v string) { fmt.Fprintf(&b, "%s: %s\r\n", k, v) }
	h("From", from.String())
	h("To", to.String())
	if replyTo != "" {
		if a, err := mail.ParseAddress(replyTo); err == nil {
			h("Reply-To", a.String())
		}
	}
	h("Subject", mime.QEncoding.Encode("utf-8", u.Subject()))
	h("Date", time.Now().Format(time.RFC1123Z))
	h("Message-ID", fmt.Sprintf("<%s.%s@%s>", u.Order.Reference, randomHex(8), domain))
	h("MIME-Version", "1.0")
	h("Content-Type", `multipart/alternative; boundary="`+boundary+`"`)
	b.WriteString("\r\n")

	part := func(contentType, body string) {
		fmt.Fprintf(&b, "--%s\r\nContent-Type: %s; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n", boundary, contentType)
		qp := quotedprintable.NewWriter(&b)
		_, _ = qp.Write([]byte(strings.ReplaceAll(body, "\n", "\r\n")))
		_ = qp.Close()
		b.WriteString("\r\n")
	}
	part("text/plain", EmailText(u))
	part("text/html", html.String())
	fmt.Fprintf(&b, "--%s--\r\n", boundary)
	return b.Bytes(), nil
}

// EmailText is the plain-text version of the email.
func EmailText(u Update) string {
	o := u.Order
	var b strings.Builder
	fmt.Fprintf(&b, "Hi %s,\n\n%s\n\nOrder reference: %s\n", u.FirstName(), capitalize(u.Sentence()), o.Reference)
	if u.OrderURL != "" {
		fmt.Fprintf(&b, "Track your order: %s\n", u.OrderURL)
	}
	b.WriteString("\n")
	for _, it := range o.Items {
		fmt.Fprintf(&b, "- %d x %s%s: %s\n", it.Quantity, it.ProductName, itemOptions(it), whatsapp.Naira(it.UnitPrice*int64(it.Quantity)))
	}
	fmt.Fprintf(&b, "\nSubtotal: %s\nDelivery: %s\nTotal: %s\n", whatsapp.Naira(o.Subtotal), whatsapp.Naira(o.ShippingFee), whatsapp.Naira(o.Total))
	fmt.Fprintf(&b, "\nDelivering to: %s\n", deliveryAddress(o))
	fmt.Fprintf(&b, "\nQuestions? Reply to this email")
	if u.Store.Phone != "" {
		fmt.Fprintf(&b, " or call %s", u.Store.Phone)
	}
	fmt.Fprintf(&b, ".\n\n%s\n", u.Store.Name)
	return b.String()
}

type emailItem struct {
	Name, Options, Line string
	Quantity            int
}

type emailView struct {
	Update
	Intro, Subtotal, Delivery, Total, Address, WhatsAppURL string
	Items                                                  []emailItem
}

func emailData(u Update) emailView {
	o := u.Order
	v := emailView{
		Update:   u,
		Intro:    capitalize(u.Sentence()),
		Subtotal: whatsapp.Naira(o.Subtotal),
		Delivery: whatsapp.Naira(o.ShippingFee),
		Total:    whatsapp.Naira(o.Total),
		Address:  deliveryAddress(o),
	}
	if u.Store.WhatsApp != "" {
		v.WhatsAppURL = whatsapp.ChatLink(u.Store.WhatsApp, "Hello! I have a question about my order "+o.Reference+".")
	}
	for _, it := range o.Items {
		v.Items = append(v.Items, emailItem{
			Name:     it.ProductName,
			Options:  strings.Trim(itemOptions(it), " ()"),
			Quantity: it.Quantity,
			Line:     whatsapp.Naira(it.UnitPrice * int64(it.Quantity)),
		})
	}
	return v
}

func itemOptions(it models.OrderItem) string {
	var opts []string
	for _, s := range []string{it.Color, it.Size} {
		if s != "" {
			opts = append(opts, s)
		}
	}
	if len(opts) == 0 {
		return ""
	}
	return " (" + strings.Join(opts, ", ") + ")"
}

func deliveryAddress(o models.Order) string {
	parts := []string{o.Address}
	for _, s := range []string{o.City, o.State} {
		if s != "" {
			parts = append(parts, s)
		}
	}
	return strings.Join(parts, ", ")
}

func capitalize(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// Inline styles only: most mail clients ignore <style> blocks.
var emailTemplate = template.Must(template.New("email").Parse(`<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f1ea;font-family:Helvetica,Arial,sans-serif;color:#1f1b17">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1ea;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="padding:28px 32px 8px;text-align:center">
    <div style="font-family:Georgia,serif;font-size:20px;letter-spacing:3px;font-weight:bold">CHRIS MOORE</div>
    <div style="font-size:9px;letter-spacing:5px;color:#6f665c;margin-top:4px">INTERIOR DECOR</div>
  </td></tr>
  <tr><td style="padding:20px 32px 4px">
    <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;font-weight:normal">{{.Headline}}</h1>
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6">Hi {{.FirstName}},</p>
    <p style="margin:0;font-size:15px;line-height:1.6">{{.Intro}}</p>
  </td></tr>
  <tr><td style="padding:20px 32px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf8f4;border:1px solid #e6ddd1;border-radius:8px">
      <tr><td style="padding:14px 16px;font-size:13px;color:#6f665c">Order reference</td>
          <td style="padding:14px 16px;font-size:15px;font-weight:bold;text-align:right;letter-spacing:1px">{{.Order.Reference}}</td></tr>
    </table>
    {{if .OrderURL}}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto 0"><tr><td style="background:#a8875e;border-radius:6px">
      <a href="{{.OrderURL}}" style="display:inline-block;padding:13px 28px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold;letter-spacing:1.5px">TRACK YOUR ORDER</a>
    </td></tr></table>
    <p style="margin:10px 0 0;font-size:12px;color:#9a9086;text-align:center">Open this link on any device to see your order's status{{if ne .Order.PaymentStatus "paid"}} or pay online{{end}}.</p>
    {{end}}
  </td></tr>
  <tr><td style="padding:0 32px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
      {{range .Items}}
      <tr><td style="padding:10px 0;border-bottom:1px solid #e6ddd1">{{.Quantity}} &times; {{.Name}}{{if .Options}}<br><span style="font-size:12px;color:#6f665c">{{.Options}}</span>{{end}}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e6ddd1;text-align:right;white-space:nowrap">{{.Line}}</td></tr>
      {{end}}
      <tr><td style="padding:10px 0 2px;color:#6f665c">Subtotal</td><td style="padding:10px 0 2px;text-align:right">{{.Subtotal}}</td></tr>
      <tr><td style="padding:2px 0;color:#6f665c">Delivery</td><td style="padding:2px 0;text-align:right">{{.Delivery}}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold;font-size:16px">Total</td><td style="padding:8px 0;text-align:right;font-weight:bold;font-size:16px">{{.Total}}</td></tr>
    </table>
    <p style="margin:12px 0 0;font-size:13px;color:#6f665c;line-height:1.5"><strong style="color:#1f1b17">Delivering to:</strong> {{.Address}}</p>
  </td></tr>
  <tr><td style="padding:24px 32px 28px">
    <p style="margin:0;font-size:13px;color:#6f665c;line-height:1.6">Questions? Reply to this email{{if .Store.Phone}}, call {{.Store.Phone}}{{end}}{{if .WhatsAppURL}} or <a href="{{.WhatsAppURL}}" style="color:#8c6d46">chat with us on WhatsApp</a>{{end}}.</p>
  </td></tr>
</table>
<p style="margin:16px 0 0;font-size:11px;color:#9a9086">{{.Store.Name}}</p>
</td></tr></table>
</body></html>`))
