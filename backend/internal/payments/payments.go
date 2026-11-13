// Package payments integrates Paystack and Flutterwave hosted checkout.
package payments

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

var ErrNotConfigured = errors.New("payment provider is not configured")

type InitRequest struct {
	Reference   string
	AmountKobo  int64
	Email       string
	Phone       string
	Name        string
	CallbackURL string
	OrderRef    string
	// Description shown on the checkout page; defaults to "Order {OrderRef}".
	Description string
}

func (r InitRequest) description() string {
	if r.Description != "" {
		return r.Description
	}
	return "Order " + r.OrderRef
}

type Result struct {
	Success bool
	// Status is the provider's raw transaction status, e.g. "success",
	// "failed", "abandoned" (Paystack) or "successful", "failed" (Flutterwave).
	Status     string
	AmountKobo int64
	Currency   string
	Raw        any
}

type Provider interface {
	Name() string
	Configured() bool
	Initialize(ctx context.Context, r InitRequest) (checkoutURL string, err error)
	Verify(ctx context.Context, reference string) (Result, error)
}

var client = &http.Client{Timeout: 20 * time.Second}

func doJSON(ctx context.Context, method, url, bearer string, body any, out any) error {
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, rdr)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+bearer)
	req.Header.Set("Content-Type", "application/json")
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	data, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("unexpected response (%d): %s", res.StatusCode, truncate(string(data), 200))
	}
	if res.StatusCode >= 400 {
		return fmt.Errorf("provider returned %d: %s", res.StatusCode, truncate(string(data), 200))
	}
	return nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
