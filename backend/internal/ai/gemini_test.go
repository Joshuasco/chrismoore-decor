package ai

import (
	"context"
	"strings"
	"testing"
)

func TestFallbackResponse(t *testing.T) {
	asst := New("", "gemini-2.5-flash", nil, "https://chrismooredecor.com", false)

	// Customer query fallback
	custReply := asst.fallbackResponse(context.Background(), false, "hello", false)
	if !strings.Contains(custReply, "https://chrismooredecor.com") {
		t.Errorf("expected customer reply to include website URL, got: %s", custReply)
	}

	// Owner audio fallback
	audioReply := asst.fallbackResponse(context.Background(), true, "", true)
	if !strings.Contains(audioReply, "GEMINI_API_KEY") {
		t.Errorf("expected audio fallback to prompt for GEMINI_API_KEY, got: %s", audioReply)
	}

	// Owner default text help
	helpReply := asst.fallbackResponse(context.Background(), true, "help", false)
	if !strings.Contains(helpReply, "sales") {
		t.Errorf("expected help reply to list sales command, got: %s", helpReply)
	}
}

func TestBuildTools(t *testing.T) {
	asst := New("test-key", "gemini-2.5-flash", nil, "https://chrismooredecor.com", false)

	ownerTools := asst.buildTools(true)
	if len(ownerTools) == 0 || len(ownerTools[0].FunctionDeclarations) < 4 {
		t.Errorf("expected at least 4 tools for owner, got %d", len(ownerTools[0].FunctionDeclarations))
	}

	custTools := asst.buildTools(false)
	if len(custTools) == 0 || len(custTools[0].FunctionDeclarations) > 2 {
		t.Errorf("expected 2 tools for customer, got %d", len(custTools[0].FunctionDeclarations))
	}
}
