package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"chrismoore-decor/backend/internal/models"
	"chrismoore-decor/backend/internal/whatsapp"
)

// WhatsAppTemplate sends an approved WhatsApp Cloud API template message to
// the customer. A template is required: the store messages the customer
// first, outside WhatsApp's 24-hour chat window. The template body takes
// four parameters, in order: first name, update sentence, order reference
// and tracking link (see the README for the exact text to submit to Meta).
type WhatsAppTemplate struct {
	Token         string
	PhoneNumberID string
	Template      string // e.g. "order_update"
	Language      string // template language code, e.g. "en"
	BaseURL       string // defaults to the Graph API
	Client        *http.Client
}

func (w WhatsAppTemplate) Name() string { return "whatsapp" }
func (w WhatsAppTemplate) Enabled() bool {
	return w.Token != "" && w.PhoneNumberID != "" && w.Template != ""
}

func (w WhatsAppTemplate) Recipient(o models.Order) string {
	return whatsapp.InternationalPhone(o.Phone)
}

// TemplateParams are the template's {{1}}…{{4}} values.
func TemplateParams(u Update) []string {
	link := u.OrderURL
	if link == "" {
		link = u.Order.Reference
	}
	return []string{oneLine(u.FirstName()), oneLine(u.Sentence()), u.Order.Reference, link}
}

func (w WhatsAppTemplate) Send(ctx context.Context, to string, u Update) error {
	base := strings.TrimRight(w.BaseURL, "/")
	if base == "" {
		base = "https://graph.facebook.com/v21.0"
	}
	lang := w.Language
	if lang == "" {
		lang = "en"
	}
	params := []map[string]string{}
	for _, p := range TemplateParams(u) {
		params = append(params, map[string]string{"type": "text", "text": p})
	}
	body, _ := json.Marshal(map[string]any{
		"messaging_product": "whatsapp",
		"to":                to,
		"type":              "template",
		"template": map[string]any{
			"name":       w.Template,
			"language":   map[string]string{"code": lang},
			"components": []any{map[string]any{"type": "body", "parameters": params}},
		},
	})
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/"+w.PhoneNumberID+"/messages", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+w.Token)
	req.Header.Set("Content-Type", "application/json")
	client := w.Client
	if client == nil {
		client = http.DefaultClient
	}
	res, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("whatsapp: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode < 300 {
		return nil
	}
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 64<<10))
	var out struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	msg := strings.TrimSpace(string(raw))
	if json.Unmarshal(raw, &out) == nil && out.Error.Message != "" {
		msg = out.Error.Message
	}
	return fmt.Errorf("whatsapp: status %d: %s", res.StatusCode, truncate(msg, 200))
}
