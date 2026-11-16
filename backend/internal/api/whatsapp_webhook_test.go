package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"chrismoore-decor/backend/internal/cache"
	"chrismoore-decor/backend/internal/config"
	"chrismoore-decor/backend/internal/store"
)

func TestWhatsAppWebhookVerification(t *testing.T) {
	cfg := config.Config{
		WhatsAppVerifyToken: "secret_verify_token_123",
	}
	srv := NewServer(cfg, store.New(nil), &cache.Cache{})

	// Successful verification
	req := httptest.NewRequest(http.MethodGet, "/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=secret_verify_token_123&hub.challenge=test_challenge_code", nil)
	rr := httptest.NewRecorder()
	srv.verifyWhatsAppWebhook(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rr.Code)
	}
	if rr.Body.String() != "test_challenge_code" {
		t.Fatalf("expected challenge body, got %q", rr.Body.String())
	}

	// Invalid token
	reqBad := httptest.NewRequest(http.MethodGet, "/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test_challenge_code", nil)
	rrBad := httptest.NewRecorder()
	srv.verifyWhatsAppWebhook(rrBad, reqBad)

	if rrBad.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for bad token, got %d", rrBad.Code)
	}
}

func TestWhatsAppWebhookPost(t *testing.T) {
	cfg := config.Config{
		WhatsAppVerifyToken: "secret_verify_token_123",
	}
	srv := NewServer(cfg, store.New(nil), &cache.Cache{})

	// Post webhook payload
	payload := `{
		"object": "whatsapp_business_account",
		"entry": [{
			"id": "123",
			"changes": [{
				"value": {
					"messaging_product": "whatsapp",
					"messages": [{
						"from": "2347054974199",
						"id": "wamid.test1",
						"type": "text",
						"text": {"body": "stats"}
					}]
				}
			}]
		}]
	}`

	req := httptest.NewRequest(http.MethodPost, "/api/webhooks/whatsapp", bytes.NewBufferString(payload))
	rr := httptest.NewRecorder()
	srv.handleWhatsAppWebhook(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rr.Code)
	}
}
