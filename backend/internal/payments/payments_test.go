package payments

import (
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPaystackInitializeAndVerify(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer sk_test" {
			t.Errorf("missing auth header")
		}
		switch r.URL.Path {
		case "/transaction/initialize":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["amount"].(float64) != 8500000 || body["reference"] != "CM-1-ABC" || body["currency"] != "NGN" {
				t.Errorf("unexpected init body: %v", body)
			}
			w.Write([]byte(`{"status":true,"data":{"authorization_url":"https://checkout.paystack.com/x"}}`))
		case "/transaction/verify/CM-1-ABC":
			w.Write([]byte(`{"status":true,"data":{"status":"success","amount":8500000,"currency":"NGN","reference":"CM-1-ABC"}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	p := NewPaystack("sk_test")
	p.BaseURL = srv.URL
	url, err := p.Initialize(context.Background(), InitRequest{Reference: "CM-1-ABC", AmountKobo: 8500000, Email: "a@b.co"})
	if err != nil || url != "https://checkout.paystack.com/x" {
		t.Fatalf("init: %q %v", url, err)
	}
	res, err := p.Verify(context.Background(), "CM-1-ABC")
	if err != nil || !res.Success || res.AmountKobo != 8500000 || res.Currency != "NGN" {
		t.Fatalf("verify: %+v %v", res, err)
	}
}

func TestPaystackSignature(t *testing.T) {
	p := NewPaystack("sk_test")
	body := []byte(`{"event":"charge.success"}`)
	mac := hmac.New(sha512.New, []byte("sk_test"))
	mac.Write(body)
	if !p.ValidSignature(body, hex.EncodeToString(mac.Sum(nil))) {
		t.Fatal("valid signature rejected")
	}
	if p.ValidSignature(body, "deadbeef") || p.ValidSignature(body, "") {
		t.Fatal("invalid signature accepted")
	}
}

func TestFlutterwaveVerifyConvertsToKobo(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/payments":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["amount"].(float64) != 85000.5 {
				t.Errorf("amount should be in naira, got %v", body["amount"])
			}
			w.Write([]byte(`{"status":"success","data":{"link":"https://flw.example/pay"}}`))
		case "/transactions/verify_by_reference":
			if r.URL.Query().Get("tx_ref") != "CM-2-XYZ" {
				t.Errorf("bad tx_ref")
			}
			w.Write([]byte(`{"status":"success","data":{"status":"successful","amount":85000.5,"currency":"NGN","tx_ref":"CM-2-XYZ"}}`))
		}
	}))
	defer srv.Close()

	f := NewFlutterwave("FLWSECK_TEST", "hash")
	f.BaseURL = srv.URL
	if link, err := f.Initialize(context.Background(), InitRequest{Reference: "CM-2-XYZ", AmountKobo: 8500050}); err != nil || link == "" {
		t.Fatalf("init: %v", err)
	}
	res, err := f.Verify(context.Background(), "CM-2-XYZ")
	if err != nil || !res.Success || res.AmountKobo != 8500050 {
		t.Fatalf("verify: %+v %v", res, err)
	}
	if !f.ValidHash("hash") || f.ValidHash("nope") {
		t.Fatal("hash check wrong")
	}
}

func TestNotConfigured(t *testing.T) {
	if _, err := NewPaystack("").Initialize(context.Background(), InitRequest{}); err != ErrNotConfigured {
		t.Fatal("expected ErrNotConfigured")
	}
	if NewFlutterwave("", "").ValidHash("") {
		t.Fatal("empty hash must never validate")
	}
}
