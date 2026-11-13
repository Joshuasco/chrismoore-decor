package payments

import (
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

type Paystack struct {
	SecretKey string
	BaseURL   string
}

func NewPaystack(secret string) *Paystack {
	return &Paystack{SecretKey: secret, BaseURL: "https://api.paystack.co"}
}

func (p *Paystack) Name() string     { return "paystack" }
func (p *Paystack) Configured() bool { return p.SecretKey != "" }

func (p *Paystack) Initialize(ctx context.Context, r InitRequest) (string, error) {
	if !p.Configured() {
		return "", ErrNotConfigured
	}
	var res struct {
		Status  bool   `json:"status"`
		Message string `json:"message"`
		Data    struct {
			AuthorizationURL string `json:"authorization_url"`
		} `json:"data"`
	}
	body := map[string]any{
		"email":        r.Email,
		"amount":       r.AmountKobo,
		"currency":     "NGN",
		"reference":    r.Reference,
		"callback_url": r.CallbackURL,
		"metadata": map[string]any{
			"order_reference": r.OrderRef,
			"custom_fields": []map[string]string{
				{"display_name": strings.SplitN(r.description(), " ", 2)[0], "variable_name": "order_reference", "value": r.OrderRef},
				{"display_name": "Customer", "variable_name": "customer_name", "value": r.Name},
			},
		},
	}
	if err := doJSON(ctx, http.MethodPost, p.BaseURL+"/transaction/initialize", p.SecretKey, body, &res); err != nil {
		return "", err
	}
	if !res.Status || res.Data.AuthorizationURL == "" {
		return "", fmt.Errorf("paystack: %s", res.Message)
	}
	return res.Data.AuthorizationURL, nil
}

func (p *Paystack) Verify(ctx context.Context, reference string) (Result, error) {
	if !p.Configured() {
		return Result{}, ErrNotConfigured
	}
	var res struct {
		Status  bool   `json:"status"`
		Message string `json:"message"`
		Data    struct {
			Status    string `json:"status"`
			Amount    int64  `json:"amount"`
			Currency  string `json:"currency"`
			Reference string `json:"reference"`
			Channel   string `json:"channel"`
			PaidAt    string `json:"paid_at"`
		} `json:"data"`
	}
	if err := doJSON(ctx, http.MethodGet, p.BaseURL+"/transaction/verify/"+url.PathEscape(reference), p.SecretKey, nil, &res); err != nil {
		return Result{}, err
	}
	if !res.Status {
		return Result{}, fmt.Errorf("paystack: %s", res.Message)
	}
	return Result{
		Success:    res.Data.Status == "success" && res.Data.Reference == reference,
		Status:     res.Data.Status,
		AmountKobo: res.Data.Amount,
		Currency:   res.Data.Currency,
		Raw:        res.Data,
	}, nil
}

// ValidSignature checks the x-paystack-signature header (HMAC-SHA512 of the
// raw body keyed with the secret key).
func (p *Paystack) ValidSignature(body []byte, signature string) bool {
	if !p.Configured() || signature == "" {
		return false
	}
	mac := hmac.New(sha512.New, []byte(p.SecretKey))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}
