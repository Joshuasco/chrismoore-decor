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

// Termii sends SMS through Termii (termii.com), a Nigerian SMS gateway.
type Termii struct {
	APIKey   string
	SenderID string // approved sender ID, e.g. "ChrisMoore"
	// BaseURL is the account's API base URL from the Termii dashboard.
	BaseURL string
	// Route: "dnd" also reaches numbers on Do-Not-Disturb (most Nigerian
	// lines) and is meant for transactional messages; "generic" doesn't.
	Route  string
	Client *http.Client
}

func (t Termii) Name() string  { return "sms" }
func (t Termii) Enabled() bool { return t.APIKey != "" && t.SenderID != "" }

func (t Termii) Recipient(o models.Order) string { return whatsapp.InternationalPhone(o.Phone) }

// SMSText is the message body: one or two SMS parts, with the tracking link.
func SMSText(u Update) string {
	name := u.Store.Name
	if name == "Chris Moore Interior Decor" {
		name = "Chris Moore Decor" // keep the SMS short
	}
	msg := fmt.Sprintf("%s: Hi %s, %s Order %s.", name, u.FirstName(), u.Sentence(), u.Order.Reference)
	if u.OrderURL != "" {
		msg += " Track it: " + u.OrderURL
	}
	return msg
}

func (t Termii) Send(ctx context.Context, to string, u Update) error {
	base := strings.TrimRight(t.BaseURL, "/")
	if base == "" {
		base = "https://api.ng.termii.com"
	}
	route := t.Route
	if route == "" {
		route = "dnd"
	}
	body, _ := json.Marshal(map[string]string{
		"api_key": t.APIKey,
		"to":      to,
		"from":    t.SenderID,
		"sms":     SMSText(u),
		"type":    "plain",
		"channel": route,
	})
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/api/sms/send", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	client := t.Client
	if client == nil {
		client = http.DefaultClient
	}
	res, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("termii: %w", err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 64<<10))
	var out struct {
		Code      string `json:"code"`
		Message   string `json:"message"`
		MessageID any    `json:"message_id"`
	}
	_ = json.Unmarshal(raw, &out)
	if res.StatusCode >= 300 || (out.Code != "" && out.Code != "ok") {
		msg := out.Message
		if msg == "" {
			msg = strings.TrimSpace(string(raw))
		}
		return fmt.Errorf("termii: status %d: %s", res.StatusCode, truncate(msg, 200))
	}
	return nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
