package payments

import (
	"context"
	"crypto/subtle"
	"fmt"
	"math"
	"net/http"
	"net/url"
)

type Flutterwave struct {
	SecretKey  string
	SecretHash string
	BaseURL    string
}

func NewFlutterwave(secret, hash string) *Flutterwave {
	return &Flutterwave{SecretKey: secret, SecretHash: hash, BaseURL: "https://api.flutterwave.com/v3"}
}

func (f *Flutterwave) Name() string     { return "flutterwave" }
func (f *Flutterwave) Configured() bool { return f.SecretKey != "" }

func (f *Flutterwave) Initialize(ctx context.Context, r InitRequest) (string, error) {
	if !f.Configured() {
		return "", ErrNotConfigured
	}
	var res struct {
		Status  string `json:"status"`
		Message string `json:"message"`
		Data    struct {
			Link string `json:"link"`
		} `json:"data"`
	}
	body := map[string]any{
		"tx_ref":       r.Reference,
		"amount":       float64(r.AmountKobo) / 100,
		"currency":     "NGN",
		"redirect_url": r.CallbackURL,
		"customer": map[string]string{
			"email":       r.Email,
			"phonenumber": r.Phone,
			"name":        r.Name,
		},
		"customizations": map[string]string{
			"title":       "Chris Moore Interior Decor",
			"description": r.description(),
		},
		"meta": map[string]string{"order_reference": r.OrderRef},
	}
	if err := doJSON(ctx, http.MethodPost, f.BaseURL+"/payments", f.SecretKey, body, &res); err != nil {
		return "", err
	}
	if res.Status != "success" || res.Data.Link == "" {
		return "", fmt.Errorf("flutterwave: %s", res.Message)
	}
	return res.Data.Link, nil
}

func (f *Flutterwave) Verify(ctx context.Context, reference string) (Result, error) {
	if !f.Configured() {
		return Result{}, ErrNotConfigured
	}
	var res struct {
		Status  string `json:"status"`
		Message string `json:"message"`
		Data    struct {
			Status   string  `json:"status"`
			Amount   float64 `json:"amount"`
			Currency string  `json:"currency"`
			TxRef    string  `json:"tx_ref"`
			ID       int64   `json:"id"`
		} `json:"data"`
	}
	endpoint := f.BaseURL + "/transactions/verify_by_reference?tx_ref=" + url.QueryEscape(reference)
	if err := doJSON(ctx, http.MethodGet, endpoint, f.SecretKey, nil, &res); err != nil {
		return Result{}, err
	}
	if res.Status != "success" {
		return Result{}, fmt.Errorf("flutterwave: %s", res.Message)
	}
	return Result{
		Success:    res.Data.Status == "successful" && res.Data.TxRef == reference,
		Status:     res.Data.Status,
		AmountKobo: int64(math.Round(res.Data.Amount * 100)),
		Currency:   res.Data.Currency,
		Raw:        res.Data,
	}, nil
}

// ValidHash checks the verif-hash header against the secret hash configured
// in the Flutterwave dashboard.
func (f *Flutterwave) ValidHash(h string) bool {
	return f.SecretHash != "" && subtle.ConstantTimeCompare([]byte(h), []byte(f.SecretHash)) == 1
}
