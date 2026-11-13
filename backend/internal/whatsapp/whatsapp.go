// Package whatsapp builds click-to-chat order links and optionally notifies
// the store owner through the WhatsApp Cloud API.
package whatsapp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
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
	if !n.Enabled() {
		return
	}
	body, _ := json.Marshal(map[string]any{
		"messaging_product": "whatsapp",
		"to":                digits.ReplaceAllString(n.NotifyTo, ""),
		"type":              "text",
		"text":              map[string]string{"body": text},
	})
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://graph.facebook.com/v21.0/"+n.PhoneNumberID+"/messages", bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Authorization", "Bearer "+n.Token)
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("whatsapp notify: %v", err)
		return
	}
	res.Body.Close()
	if res.StatusCode >= 300 {
		log.Printf("whatsapp notify: status %d", res.StatusCode)
	}
}
