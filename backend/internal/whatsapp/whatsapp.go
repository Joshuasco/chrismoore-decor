// Package whatsapp builds click-to-chat order links and optionally notifies
// the store owner through the WhatsApp Cloud API.
package whatsapp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"regexp"
	"strings"
	"time"

	"chrismoore-decor/backend/internal/models"
)

var digits = regexp.MustCompile(`\D`)

// Naira formats kobo as a naira string, e.g. 8500000 -> "₦85,000".
func Naira(kobo int64) string {
	n := kobo / 100
	s := fmt.Sprintf("%d", n)
	var b strings.Builder
	for i, r := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(r)
	}
	if rem := kobo % 100; rem != 0 {
		return fmt.Sprintf("₦%s.%02d", b.String(), rem)
	}
	return "₦" + b.String()
}

// OrderMessage is the pre-filled chat text the shopper sends to the store.
func OrderMessage(o models.Order, orderURL string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Hello Chris Moore Interior Decor! 👋\nI'd like to place an order.\n\n")
	fmt.Fprintf(&b, "*Order ref:* %s\n\n", o.Reference)
	for _, it := range o.Items {
		opts := []string{}
		if it.Color != "" {
			opts = append(opts, it.Color)
		}
		if it.Size != "" {
			opts = append(opts, it.Size)
		}
		extra := ""
		if len(opts) > 0 {
			extra = " (" + strings.Join(opts, ", ") + ")"
		}
		fmt.Fprintf(&b, "• %d × %s%s — %s\n", it.Quantity, it.ProductName, extra, Naira(it.UnitPrice*int64(it.Quantity)))
	}
	fmt.Fprintf(&b, "\nSubtotal: %s\nDelivery: %s\n*Total: %s*\n\n", Naira(o.Subtotal), Naira(o.ShippingFee), Naira(o.Total))
	fmt.Fprintf(&b, "*Name:* %s\n*Phone:* %s\n*Address:* %s", o.CustomerName, o.Phone, o.Address)
	if o.City != "" || o.State != "" {
		fmt.Fprintf(&b, ", %s", strings.Trim(strings.Join([]string{o.City, o.State}, ", "), ", "))
	}
	if o.Notes != "" {
		fmt.Fprintf(&b, "\n*Notes:* %s", o.Notes)
	}
	if orderURL != "" {
		fmt.Fprintf(&b, "\n\nOrder details & online payment: %s", orderURL)
	}
	return b.String()
}

// InternationalPhone converts a Nigerian number in any common format
// ("0803 123 4567", "+234 803…", "803…") to international digits
// ("2348031234567"). Numbers already in another international format are
// returned as digits.
func InternationalPhone(phone string) string {
	d := digits.ReplaceAllString(phone, "")
	switch {
	case strings.HasPrefix(d, "00"):
		d = d[2:]
	case len(d) == 11 && strings.HasPrefix(d, "0"):
		d = "234" + d[1:]
	case len(d) == 10 && strings.ContainsAny(d[:1], "789"):
		d = "234" + d
	}
	return d
}

// ChatLink returns a wa.me deep link that opens WhatsApp with the message.
func ChatLink(number, message string) string {
	return "https://wa.me/" + digits.ReplaceAllString(number, "") + "?text=" + url.QueryEscape(message)
}

type Notifier struct {
	Token         string
	PhoneNumberID string
	NotifyTo      string
}

func (n Notifier) Enabled() bool {
	return n.Token != "" && n.PhoneNumberID != "" && n.NotifyTo != ""
}

// NotifyNewOrder sends a plain-text message to the store owner. Free-form
// messages only deliver inside a 24h customer-service window; for
// production use, switch this to an approved template message.
func (n Notifier) NotifyNewOrder(ctx context.Context, o models.Order, adminURL string) {
	n.NotifyText(ctx, fmt.Sprintf("🛍️ New %s order %s\n%s · %s\nTotal: %s\n%s",
		o.Channel, o.Reference, o.CustomerName, o.Phone, Naira(o.Total), adminURL))
}

// NotifyText sends a plain-text alert to the store owner, if configured.
func (n Notifier) NotifyText(ctx context.Context, text string) {
	_ = n.SendText(ctx, n.NotifyTo, text)
}

// SendText sends a free-form WhatsApp text message to any recipient.
func (n Notifier) SendText(ctx context.Context, to, text string) error {
	if n.Token == "" || n.PhoneNumberID == "" || to == "" {
		return nil
	}
	body, _ := json.Marshal(map[string]any{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                digits.ReplaceAllString(to, ""),
		"type":              "text",
		"text":              map[string]string{"body": text},
	})
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://graph.facebook.com/v21.0/"+n.PhoneNumberID+"/messages", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+n.Token)
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("whatsapp send text: %v", err)
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		raw, _ := io.ReadAll(res.Body)
		log.Printf("whatsapp send text error: status %d: %s", res.StatusCode, string(raw))
		return fmt.Errorf("whatsapp send status %d: %s", res.StatusCode, string(raw))
	}
	return nil
}

// SendAudio sends a voice note / audio message via media ID to any recipient.
func (n Notifier) SendAudio(ctx context.Context, to, mediaID string) error {
	if n.Token == "" || n.PhoneNumberID == "" || to == "" || mediaID == "" {
		return nil
	}
	body, _ := json.Marshal(map[string]any{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                digits.ReplaceAllString(to, ""),
		"type":              "audio",
		"audio":             map[string]string{"id": mediaID},
	})
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://graph.facebook.com/v21.0/"+n.PhoneNumberID+"/messages", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+n.Token)
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("whatsapp send audio: %v", err)
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		raw, _ := io.ReadAll(res.Body)
		log.Printf("whatsapp send audio error: status %d: %s", res.StatusCode, string(raw))
		return fmt.Errorf("whatsapp send audio status %d: %s", res.StatusCode, string(raw))
	}
	return nil
}

// UploadMedia uploads binary audio data to Meta and returns the media ID.
func (n Notifier) UploadMedia(ctx context.Context, data []byte, mimeType, filename string) (string, error) {
	if n.Token == "" || n.PhoneNumberID == "" {
		return "", errors.New("whatsapp: token or phone number id not configured")
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	if err := w.WriteField("messaging_product", "whatsapp"); err != nil {
		return "", err
	}
	if err := w.WriteField("type", mimeType); err != nil {
		return "", err
	}

	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, filename))
	h.Set("Content-Type", mimeType)
	part, err := w.CreatePart(h)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(data); err != nil {
		return "", err
	}
	if err := w.Close(); err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://graph.facebook.com/v21.0/"+n.PhoneNumberID+"/media", &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+n.Token)
	req.Header.Set("Content-Type", w.FormDataContentType())

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("upload media: %w", err)
	}
	defer res.Body.Close()

	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("upload media status %d: %s", res.StatusCode, string(raw))
	}

	var out struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(raw, &out); err != nil || out.ID == "" {
		return "", fmt.Errorf("parse upload media response: %s", string(raw))
	}
	return out.ID, nil
}

// DownloadMedia fetches audio/media bytes and MIME type from Meta given a media ID.
func (n Notifier) DownloadMedia(ctx context.Context, mediaID string) ([]byte, string, error) {
	if n.Token == "" {
		return nil, "", errors.New("whatsapp: token not configured")
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Step 1: Retrieve media URL from Meta Graph API
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://graph.facebook.com/v21.0/"+mediaID, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Authorization", "Bearer "+n.Token)

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("retrieve media url: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return nil, "", fmt.Errorf("retrieve media url status %d: %s", res.StatusCode, string(b))
	}

	var mediaMeta struct {
		URL      string `json:"url"`
		MIMEType string `json:"mime_type"`
	}
	if err := json.NewDecoder(res.Body).Decode(&mediaMeta); err != nil {
		return nil, "", fmt.Errorf("decode media metadata: %w", err)
	}
	if mediaMeta.URL == "" {
		return nil, "", errors.New("empty media url returned by Meta")
	}

	// Step 2: Download raw binary data from returned URL
	dlReq, err := http.NewRequestWithContext(ctx, http.MethodGet, mediaMeta.URL, nil)
	if err != nil {
		return nil, "", err
	}
	dlReq.Header.Set("Authorization", "Bearer "+n.Token)
	dlReq.Header.Set("User-Agent", "curl/7.68.0")

	dlRes, err := http.DefaultClient.Do(dlReq)
	if err != nil {
		return nil, "", fmt.Errorf("download media content: %w", err)
	}
	defer dlRes.Body.Close()

	if dlRes.StatusCode >= 300 {
		return nil, "", fmt.Errorf("download media status %d", dlRes.StatusCode)
	}

	data, err := io.ReadAll(io.LimitReader(dlRes.Body, 25<<20)) // max 25MB
	if err != nil {
		return nil, "", fmt.Errorf("read media content: %w", err)
	}

	return data, mediaMeta.MIMEType, nil
}
