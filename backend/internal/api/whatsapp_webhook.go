package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"chrismoore-decor/backend/internal/whatsapp"
)

// In-memory message deduplication cache if redis is down
var (
	seenWAMessages sync.Map
)

func isDuplicateWAMessage(id string) bool {
	if id == "" {
		return false
	}
	if _, loaded := seenWAMessages.LoadOrStore(id, time.Now()); loaded {
		return true
	}
	return false
}

// verifyWhatsAppWebhook handles Meta's webhook verification challenge (GET).
func (s *Server) verifyWhatsAppWebhook(w http.ResponseWriter, r *http.Request) {
	mode := r.URL.Query().Get("hub.mode")
	token := r.URL.Query().Get("hub.verify_token")
	challenge := r.URL.Query().Get("hub.challenge")
	// printf("WhatsApp webhook verification: mode=%s, token=%s, challenge=%s", mode, token, challenge)

	expected := strings.TrimSpace(s.cfg.WhatsAppVerifyToken)
	if expected == "" {
		// If not configured, deny verification to prevent unauthorized hooks
		http.Error(w, "WHATSAPP_VERIFY_TOKEN not configured", http.StatusForbidden)
		return
	}

	if mode == "subscribe" && token == expected {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(challenge))
		return
	}

	http.Error(w, "invalid verification token", http.StatusForbidden)
}

type waWebhookPayload struct {
	Object string `json:"object"`
	Entry  []struct {
		ID      string `json:"id"`
		Changes []struct {
			Value struct {
				MessagingProduct string `json:"messaging_product"`
				Metadata         struct {
					PhoneNumberID string `json:"phone_number_id"`
				} `json:"metadata"`
				Messages []struct {
					From      string `json:"from"`
					ID        string `json:"id"`
					Timestamp string `json:"timestamp"`
					Type      string `json:"type"`
					Text      *struct {
						Body string `json:"body"`
					} `json:"text,omitempty"`
					Audio *struct {
						ID       string `json:"id"`
						MimeType string `json:"mime_type"`
						Voice    bool   `json:"voice"`
					} `json:"audio,omitempty"`
				} `json:"messages"`
			} `json:"value"`
		} `json:"changes"`
	} `json:"entry"`
}

// handleWhatsAppWebhook handles incoming messages from Meta (POST).
func (s *Server) handleWhatsAppWebhook(w http.ResponseWriter, r *http.Request) {
	var payload waWebhookPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		// Always return 200 to acknowledge receipt to Meta
		w.WriteHeader(http.StatusOK)
		return
	}
	w.WriteHeader(http.StatusOK)

	// Process incoming messages asynchronously
	for _, entry := range payload.Entry {
		for _, change := range entry.Changes {
			for _, msg := range change.Value.Messages {
				if isDuplicateWAMessage(msg.ID) {
					continue
				}
				go s.processIncomingWAMessage(msg)
			}
		}
	}
}

func (s *Server) processIncomingWAMessage(msg struct {
	From      string `json:"from"`
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Type      string `json:"type"`
	Text      *struct {
		Body string `json:"body"`
	} `json:"text,omitempty"`
	Audio *struct {
		ID       string `json:"id"`
		MimeType string `json:"mime_type"`
		Voice    bool   `json:"voice"`
	} `json:"audio,omitempty"`
}) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	fromDigits := whatsapp.InternationalPhone(msg.From)
	ownerDigits := whatsapp.InternationalPhone(s.cfg.WhatsAppNotifyTo)
	isOwner := fromDigits != "" && ownerDigits != "" && fromDigits == ownerDigits

	var textInput string
	var audioBytes []byte
	var audioMime string

	switch msg.Type {
	case "text":
		if msg.Text != nil {
			textInput = strings.TrimSpace(msg.Text.Body)
		}
	case "audio":
		if msg.Audio != nil && msg.Audio.ID != "" {
			audioMime = msg.Audio.MimeType
			var err error
			audioBytes, audioMime, err = s.notifier.DownloadMedia(ctx, msg.Audio.ID)
			if err != nil {
				log.Printf("whatsapp: download audio error: %v", err)
				_ = s.notifier.SendText(ctx, msg.From, "⚠️ Could not download your audio message. Please try sending again.")
				return
			}
		}
	default:
		// Other media types (image, sticker, etc.)
		if isOwner {
			_ = s.notifier.SendText(ctx, msg.From, "Chris Moore Decor Assistant: I received an unsupported message type. Please send a text message or a voice note.")
		}
		return
	}

	if textInput == "" && len(audioBytes) == 0 {
		return
	}

	if s.assistant == nil {
		log.Printf("whatsapp webhook: AI assistant not initialized")
		return
	}

	replyText, replyAudio, replyAudioMime, err := s.assistant.ProcessMessage(ctx, msg.From, isOwner, textInput, audioBytes, audioMime)
	if err != nil {
		log.Printf("whatsapp ai error: %v", err)
		_ = s.notifier.SendText(ctx, msg.From, "⚠️ Sorry, I encountered an error while processing your request. Please try again.")
		return
	}

	// 1. Send text reply
	if replyText != "" {
		if err := s.notifier.SendText(ctx, msg.From, replyText); err != nil {
			log.Printf("whatsapp send text reply error: %v", err)
		}
	}

	// 2. Send audio reply if generated
	if len(replyAudio) > 0 && s.cfg.WhatsAppVoiceReply {
		mediaID, err := s.notifier.UploadMedia(ctx, replyAudio, replyAudioMime, "voice_reply.ogg")
		if err != nil {
			log.Printf("whatsapp upload audio reply error: %v", err)
		} else {
			if err := s.notifier.SendAudio(ctx, msg.From, mediaID); err != nil {
				log.Printf("whatsapp send audio reply error: %v", err)
			}
		}
	}
}
