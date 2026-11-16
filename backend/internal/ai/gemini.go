// Package ai provides the conversational AI assistant for WhatsApp,
// integrating Google Gemini to handle both text messages and voice notes
// (audio) for store owners and visually impaired users.
package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"chrismoore-decor/backend/internal/models"
	"chrismoore-decor/backend/internal/store"
	"chrismoore-decor/backend/internal/whatsapp"
)

type Assistant struct {
	APIKey      string
	Model       string
	Store       *store.Store
	FrontendURL string
	VoiceReply  bool
	client      *http.Client
}

func New(apiKey, model string, st *store.Store, frontendURL string, voiceReply bool) *Assistant {
	if model == "" {
		model = "gemini-flash-lite-latest"
	}
	return &Assistant{
		APIKey:      strings.TrimSpace(apiKey),
		Model:       strings.TrimSpace(model),
		Store:       st,
		FrontendURL: strings.TrimRight(frontendURL, "/"),
		VoiceReply:  voiceReply,
		client:      &http.Client{Timeout: 45 * time.Second},
	}
}

// ProcessMessage processes an incoming WhatsApp message (text or audio voice note)
// from either the store owner or a customer, and returns the response text and optional audio.
func (a *Assistant) ProcessMessage(ctx context.Context, senderPhone string, isOwner bool, textInput string, audioInput []byte, audioMime string) (replyText string, replyAudio []byte, replyAudioMime string, err error) {
	// If Gemini API Key is not configured, provide a robust rule-based fallback
	if a.APIKey == "" {
		replyText = a.fallbackResponse(ctx, isOwner, textInput, len(audioInput) > 0)
		return replyText, nil, "", nil
	}

	replyText, replyAudio, replyAudioMime, err = a.callGemini(ctx, isOwner, textInput, audioInput, audioMime)
	if err != nil {
		return "", nil, "", err
	}

	// Generate voice reply if enabled (or if user asked with a voice note)
	if a.VoiceReply && isOwner && replyText != "" && len(replyAudio) == 0 {
		oggBytes, mime, ttsErr := a.textToSpeech(ctx, replyText)
		if ttsErr != nil {
			log.Printf("gemini tts voice reply error: %v", ttsErr)
		} else {
			replyAudio = oggBytes
			replyAudioMime = mime
		}
	}

	return replyText, replyAudio, replyAudioMime, nil
}

func (a *Assistant) fallbackResponse(ctx context.Context, isOwner bool, text string, isAudio bool) string {
	if !isOwner {
		return fmt.Sprintf("Hello! 👋 Welcome to Chris Moore Interior Decor.\nBrowse our catalog and place orders online at %s, or reply with your inquiry.", a.FrontendURL)
	}

	if isAudio {
		return "🎙️ Voice message received!\n\nTo enable voice transcription and AI audio comprehension, please add GEMINI_API_KEY in your backend/.env file."
	}

	cmd := strings.ToLower(strings.TrimSpace(text))
	switch {
	case strings.Contains(cmd, "stat") || strings.Contains(cmd, "sale") || strings.Contains(cmd, "revenue"):
		st, err := a.Store.Stats(ctx)
		if err != nil {
			return "⚠️ Could not retrieve store statistics right now."
		}
		return fmt.Sprintf("📊 *Store Overview*\n\n"+
			"• Total Revenue: %s\n"+
			"• Revenue This Month: %s\n"+
			"• Orders Placed Today: %d\n"+
			"• Pending Orders: %d\n"+
			"• Low Stock Items: %d",
			whatsapp.Naira(st.Revenue),
			whatsapp.Naira(st.RevenueThisMonth),
			st.OrdersToday,
			st.OrdersPending,
			st.LowStock,
		)

	case strings.Contains(cmd, "pending") || strings.Contains(cmd, "order"):
		res, err := a.Store.ListOrders(ctx, models.OrderFilter{Status: "pending", Limit: 5})
		if err != nil || len(res.Items) == 0 {
			return "✅ You have no pending orders awaiting fulfillment right now!"
		}
		var b strings.Builder
		b.WriteString("📦 *Recent Pending Orders:*\n\n")
		for _, o := range res.Items {
			fmt.Fprintf(&b, "• *%s* (%s) — %s\n  Customer: %s (%s)\n\n",
				o.Reference, o.Channel, whatsapp.Naira(o.Total), o.CustomerName, o.Phone)
		}
		return strings.TrimSpace(b.String())

	case strings.Contains(cmd, "stock"):
		res, err := a.Store.ListProducts(ctx, models.ProductFilter{Limit: 50, IncludeInactive: false})
		if err != nil {
			return "⚠️ Could not check inventory right now."
		}
		low := []string{}
		for _, p := range res.Items {
			if p.Stock <= p.LowStockThreshold {
				low = append(low, fmt.Sprintf("• %s (Stock: %d)", p.Name, p.Stock))
			}
		}
		if len(low) == 0 {
			return "✅ All products are sufficiently stocked!"
		}
		return "⚠️ *Low Stock Alert:*\n\n" + strings.Join(low, "\n")

	default:
		return "👋 *Chris Moore Decor Store Assistant*\n\n" +
			"Available commands:\n" +
			"• *sales* or *stats* — Check revenue and order metrics\n" +
			"• *pending* — View pending orders\n" +
			"• *stock* — View low stock items\n\n" +
			"💡 Add GEMINI_API_KEY in backend/.env to unlock conversational text & voice note support."
	}
}

// Gemini API schema types
type geminiRequest struct {
	SystemInstruction *geminiContent   `json:"system_instruction,omitempty"`
	Contents          []geminiContent  `json:"contents"`
	Tools             []geminiTool     `json:"tools,omitempty"`
	GenerationConfig  *geminiGenConfig `json:"generationConfig,omitempty"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text             string              `json:"text,omitempty"`
	InlineData       *geminiBlob         `json:"inline_data,omitempty"`
	FunctionCall     *geminiFunctionCall `json:"functionCall,omitempty"`
	FunctionResponse *geminiFuncResponse `json:"functionResponse,omitempty"`
	ThoughtSignature string              `json:"thoughtSignature,omitempty"`
}

type geminiBlob struct {
	MimeType string `json:"mime_type"`
	Data     string `json:"data"` // base64
}

type geminiFunctionCall struct {
	Name string         `json:"name"`
	Args map[string]any `json:"args"`
	ID   string         `json:"id,omitempty"`
}

type geminiFuncResponse struct {
	Name     string         `json:"name"`
	Response map[string]any `json:"response"`
	ID       string         `json:"id,omitempty"`
}

type geminiTool struct {
	FunctionDeclarations []geminiFuncDecl `json:"function_declarations"`
}

type geminiFuncDecl struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Parameters  geminiJSON `json:"parameters,omitempty"`
}

type geminiJSON struct {
	Type       string                 `json:"type"`
	Properties map[string]geminiProp  `json:"properties,omitempty"`
	Required   []string               `json:"required,omitempty"`
}

type geminiProp struct {
	Type        string `json:"type"`
	Description string `json:"description,omitempty"`
}

type geminiGenConfig struct {
	Temperature        float64       `json:"temperature,omitempty"`
	ResponseModalities []string      `json:"responseModalities,omitempty"`
	SpeechConfig       *geminiSpeech `json:"speechConfig,omitempty"`
}

type geminiSpeech struct {
	VoiceConfig struct {
		PrebuiltVoiceConfig struct {
			VoiceName string `json:"voiceName"`
		} `json:"prebuiltVoiceConfig"`
	} `json:"voiceConfig"`
}

type geminiResponse struct {
	Candidates []struct {
		Content geminiContent `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

func (a *Assistant) buildTools(isOwner bool) []geminiTool {
	if !isOwner {
		return []geminiTool{
			{
				FunctionDeclarations: []geminiFuncDecl{
					{
						Name:        "search_products",
						Description: "Search the store catalog for products by name or category.",
						Parameters: geminiJSON{
							Type: "OBJECT",
							Properties: map[string]geminiProp{
								"query": {Type: "STRING", Description: "Product name or search keywords"},
							},
							Required: []string{"query"},
						},
					},
					{
						Name:        "get_store_info",
						Description: "Get the store contact information, location, and operating hours.",
						Parameters: geminiJSON{
							Type: "OBJECT",
						},
					},
				},
			},
		}
	}

	return []geminiTool{
		{
			FunctionDeclarations: []geminiFuncDecl{
				{
					Name:        "get_business_stats",
					Description: "Get overall business performance: total revenue, revenue this month, orders today, pending orders count, and inventory counts.",
					Parameters: geminiJSON{
						Type: "OBJECT",
					},
				},
				{
					Name:        "get_pending_orders",
					Description: "List recent pending orders that need confirmation or fulfillment.",
					Parameters: geminiJSON{
						Type: "OBJECT",
						Properties: map[string]geminiProp{
							"limit": {Type: "INTEGER", Description: "Max orders to retrieve (default 5)"},
						},
					},
				},
				{
					Name:        "get_order_details",
					Description: "Look up full details of an order using its order reference (e.g. CM-XXXXXX).",
					Parameters: geminiJSON{
						Type: "OBJECT",
						Properties: map[string]geminiProp{
							"reference": {Type: "STRING", Description: "The order reference (e.g. CM-XXXXXX)"},
						},
						Required: []string{"reference"},
					},
				},
				{
					Name:        "get_low_stock_products",
					Description: "Check products that are low in stock or completely out of stock.",
					Parameters: geminiJSON{
						Type: "OBJECT",
					},
				},
				{
					Name:        "search_products",
					Description: "Search products in the catalog by name or keyword to check price, stock level, or status.",
					Parameters: geminiJSON{
						Type: "OBJECT",
						Properties: map[string]geminiProp{
							"query": {Type: "STRING", Description: "Product name or search query"},
						},
						Required: []string{"query"},
					},
				},
			},
		},
	}
}

func (a *Assistant) executeTool(ctx context.Context, isOwner bool, name string, args map[string]any) map[string]any {
	switch name {
	case "get_business_stats":
		if !isOwner {
			return map[string]any{"error": "unauthorized"}
		}
		st, err := a.Store.Stats(ctx)
		if err != nil {
			return map[string]any{"error": err.Error()}
		}
		return map[string]any{
			"total_revenue":          whatsapp.Naira(st.Revenue),
			"revenue_this_month":     whatsapp.Naira(st.RevenueThisMonth),
			"orders_today":           st.OrdersToday,
			"orders_pending":         st.OrdersPending,
			"orders_total":           st.OrdersTotal,
			"products_active":        st.ProductsActive,
			"low_stock_count":        st.LowStock,
			"out_of_stock_count":     st.OutOfStock,
			"inventory_total_value":  whatsapp.Naira(st.InventoryValue),
			"unpaid_invoices_count":  st.InvoicesUnpaid,
			"unpaid_invoices_amount": whatsapp.Naira(st.InvoicesOutstanding),
		}

	case "get_pending_orders":
		if !isOwner {
			return map[string]any{"error": "unauthorized"}
		}
		limit := 5
		if l, ok := args["limit"].(float64); ok && l > 0 {
			limit = int(l)
		}
		page, err := a.Store.ListOrders(ctx, models.OrderFilter{Status: "pending", Limit: limit})
		if err != nil {
			return map[string]any{"error": err.Error()}
		}
		list := []map[string]any{}
		for _, o := range page.Items {
			list = append(list, map[string]any{
				"reference":      o.Reference,
				"customer_name":  o.CustomerName,
				"phone":          o.Phone,
				"total":          whatsapp.Naira(o.Total),
				"channel":        o.Channel,
				"payment_status": o.PaymentStatus,
				"created_at":     o.CreatedAt,
				"items_count":    len(o.Items),
			})
		}
		return map[string]any{"pending_orders": list, "count": page.Total}

	case "get_order_details":
		ref, _ := args["reference"].(string)
		if ref == "" {
			return map[string]any{"error": "reference is required"}
		}
		o, err := a.Store.GetOrderByReference(ctx, ref)
		if err != nil {
			return map[string]any{"error": "order not found"}
		}
		items := []string{}
		for _, it := range o.Items {
			items = append(items, fmt.Sprintf("%d × %s (%s)", it.Quantity, it.ProductName, whatsapp.Naira(it.UnitPrice*int64(it.Quantity))))
		}
		return map[string]any{
			"reference":      o.Reference,
			"customer_name":  o.CustomerName,
			"phone":          o.Phone,
			"address":        fmt.Sprintf("%s, %s %s", o.Address, o.City, o.State),
			"subtotal":       whatsapp.Naira(o.Subtotal),
			"shipping_fee":   whatsapp.Naira(o.ShippingFee),
			"total":          whatsapp.Naira(o.Total),
			"status":         o.Status,
			"payment_status": o.PaymentStatus,
			"channel":        o.Channel,
			"items":          items,
		}

	case "get_low_stock_products":
		if !isOwner {
			return map[string]any{"error": "unauthorized"}
		}
		page, err := a.Store.ListProducts(ctx, models.ProductFilter{Limit: 50, IncludeInactive: false})
		if err != nil {
			return map[string]any{"error": err.Error()}
		}
		low := []map[string]any{}
		for _, p := range page.Items {
			if p.Stock <= p.LowStockThreshold {
				low = append(low, map[string]any{
					"name":      p.Name,
					"stock":     p.Stock,
					"threshold": p.LowStockThreshold,
					"price":     whatsapp.Naira(p.Price),
				})
			}
		}
		return map[string]any{"low_stock_products": low, "count": len(low)}

	case "search_products":
		q, _ := args["query"].(string)
		page, err := a.Store.ListProducts(ctx, models.ProductFilter{Query: q, Limit: 5, IncludeInactive: false})
		if err != nil {
			return map[string]any{"error": err.Error()}
		}
		results := []map[string]any{}
		for _, p := range page.Items {
			results = append(results, map[string]any{
				"name":        p.Name,
				"price":       whatsapp.Naira(p.Price),
				"stock":       p.Stock,
				"category":    p.CategoryName,
				"description": p.Description,
			})
		}
		return map[string]any{"products": results}

	case "get_store_info":
		settings, _ := a.Store.GetSettings(ctx)
		return map[string]any{
			"store_name":     settings["store_name"],
			"address":        settings["address"],
			"phone":          settings["contact_phone"],
			"whatsapp":       settings["whatsapp_number"],
			"email":          settings["contact_email"],
			"opening_hours":  settings["opening_hours"],
			"storefront_url": a.FrontendURL,
		}
	}

	return map[string]any{"error": "unknown tool"}
}

func (a *Assistant) callGemini(ctx context.Context, isOwner bool, textInput string, audioInput []byte, audioMime string) (replyText string, replyAudio []byte, replyAudioMime string, err error) {
	systemPrompt := `You are Chris Moore Decor's intelligent AI business assistant on WhatsApp.
Chris Moore Decor is a luxury furniture, lighting, and interior decor brand in Nigeria.

The user is interacting with you over WhatsApp. They may be visually impaired and using voice notes (audio) or screen readers.

Key Accessibility & Communication Guidelines:
1. Speak clearly, concisely, and conversationally.
2. Format monetary amounts in Nigerian Naira with commas (e.g. ₦85,000, ₦1,250,000). Never output raw numbers.
3. Avoid complex Markdown tables, ascii art, or excessive emojis that clutter audio playback or screen readers. Use clean bullet points or natural speech.
4. When asked about sales, revenue, orders, inventory, or product information, ALWAYS invoke the appropriate store tools to fetch real-time, accurate numbers. Never guess business statistics.
5. If the user sent a voice message, understand their spoken words directly, fulfill their request, and provide a helpful, natural spoken answer.`

	if !isOwner {
		systemPrompt = `You are the friendly customer service assistant for Chris Moore Decor, a luxury furniture and interior decor store in Nigeria.
Help customers with questions about products, store location, and ordering online at ` + a.FrontendURL + `.
Be polite, warm, and concise.`
	}

	// Prepare initial user message
	userParts := []geminiPart{}
	isAudioMsg := len(audioInput) > 0
	if isAudioMsg {
		mime := audioMime
		if mime == "" {
			mime = "audio/ogg"
		}
		// Strip codecs parameter if present (e.g. "audio/ogg; codecs=opus" -> "audio/ogg")
		if idx := strings.Index(mime, ";"); idx != -1 {
			mime = strings.TrimSpace(mime[:idx])
		}
		userParts = append(userParts, geminiPart{
			InlineData: &geminiBlob{
				MimeType: mime,
				Data:     base64.StdEncoding.EncodeToString(audioInput),
			},
		})
		prompt := "This is a WhatsApp voice note. Please listen, transcribe and understand what is being asked, call any necessary tools, and provide a clear, conversational answer."
		if textInput != "" {
			prompt += " User text note: " + textInput
		}
		userParts = append(userParts, geminiPart{Text: prompt})
	} else {
		userParts = append(userParts, geminiPart{Text: textInput})
	}

	contents := []geminiContent{
		{
			Role:  "user",
			Parts: userParts,
		},
	}

	tools := a.buildTools(isOwner)
	apiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", a.Model, a.APIKey)

	// Tool-calling loop (up to 5 turns)
	for turn := 0; turn < 5; turn++ {
		reqBody := geminiRequest{
			SystemInstruction: &geminiContent{
				Parts: []geminiPart{{Text: systemPrompt}},
			},
			Contents: contents,
			Tools:    tools,
			GenerationConfig: &geminiGenConfig{
				Temperature: 0.2,
			},
		}

		// If voice reply is enabled and user sent audio, request both TEXT and AUDIO
		if a.VoiceReply && isAudioMsg && turn == 0 {
			reqBody.GenerationConfig.ResponseModalities = []string{"TEXT", "AUDIO"}
			reqBody.GenerationConfig.SpeechConfig = &geminiSpeech{}
			reqBody.GenerationConfig.SpeechConfig.VoiceConfig.PrebuiltVoiceConfig.VoiceName = "Puck"
		}

		payloadBytes, _ := json.Marshal(reqBody)
		httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(payloadBytes))
		if err != nil {
			return "", nil, "", err
		}
		httpReq.Header.Set("Content-Type", "application/json")

		resp, err := a.client.Do(httpReq)
		if err != nil {
			// If audio generation failed or timed out, retry with plain text
			if reqBody.GenerationConfig != nil && len(reqBody.GenerationConfig.ResponseModalities) > 1 {
				reqBody.GenerationConfig.ResponseModalities = nil
				reqBody.GenerationConfig.SpeechConfig = nil
				payloadBytes, _ = json.Marshal(reqBody)
				httpReq, _ = http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(payloadBytes))
				httpReq.Header.Set("Content-Type", "application/json")
				resp, err = a.client.Do(httpReq)
			}
			if err != nil {
				return "", nil, "", fmt.Errorf("gemini api request: %w", err)
			}
		}

		respBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			// If error was due to audio modality not supported on this model, fallback to text
			if reqBody.GenerationConfig != nil && len(reqBody.GenerationConfig.ResponseModalities) > 1 {
				reqBody.GenerationConfig.ResponseModalities = nil
				reqBody.GenerationConfig.SpeechConfig = nil
				payloadBytes, _ = json.Marshal(reqBody)
				httpReq, _ = http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(payloadBytes))
				httpReq.Header.Set("Content-Type", "application/json")
				retryResp, retryErr := a.client.Do(httpReq)
				if retryErr == nil && retryResp.StatusCode == http.StatusOK {
					respBytes, _ = io.ReadAll(retryResp.Body)
					retryResp.Body.Close()
					resp.StatusCode = http.StatusOK
				}
			}
		}

		if resp.StatusCode != http.StatusOK {
			log.Printf("gemini api error (status %d): %s", resp.StatusCode, string(respBytes))
			return "", nil, "", fmt.Errorf("gemini status %d: %s", resp.StatusCode, string(respBytes))
		}

		var geminiRes geminiResponse
		if err := json.Unmarshal(respBytes, &geminiRes); err != nil {
			return "", nil, "", fmt.Errorf("parse gemini response: %w", err)
		}
		if len(geminiRes.Candidates) == 0 {
			return "", nil, "", errors.New("no response candidate from Gemini")
		}

		candidate := geminiRes.Candidates[0]
		contents = append(contents, candidate.Content)

		// Check if Gemini invoked a tool (FunctionCall)
		var funcCall *geminiFunctionCall
		for _, part := range candidate.Content.Parts {
			if part.FunctionCall != nil {
				funcCall = part.FunctionCall
				break
			}
		}

		if funcCall != nil {
			toolResult := a.executeTool(ctx, isOwner, funcCall.Name, funcCall.Args)
			contents = append(contents, geminiContent{
				Role: "user",
				Parts: []geminiPart{
					{
						FunctionResponse: &geminiFuncResponse{
							Name: funcCall.Name,
							ID:   funcCall.ID,
							Response: map[string]any{
								"result": toolResult,
							},
						},
					},
				},
			})
			continue
		}

		// No more function calls; extract final text and any audio parts
		var textBuilder strings.Builder
		for _, part := range candidate.Content.Parts {
			if part.Text != "" {
				textBuilder.WriteString(part.Text)
			}
			if part.InlineData != nil && strings.HasPrefix(part.InlineData.MimeType, "audio/") {
				if aud, decErr := base64.StdEncoding.DecodeString(part.InlineData.Data); decErr == nil {
					replyAudio = aud
					replyAudioMime = part.InlineData.MimeType
				}
			}
		}

		replyText = strings.TrimSpace(textBuilder.String())
		if replyText == "" && len(replyAudio) > 0 {
			replyText = "🎙️ Voice response"
		}
		return replyText, replyAudio, replyAudioMime, nil
	}

	return "I processed your request, but the operations were too complex. Please ask directly for specific sales or orders.", nil, "", nil
}

func (a *Assistant) textToSpeech(ctx context.Context, text string) ([]byte, string, error) {
	if a.APIKey == "" || strings.TrimSpace(text) == "" {
		return nil, "", errors.New("empty text or missing api key")
	}
	speechText := text
	if len(speechText) > 400 {
		speechText = speechText[:400] + "..."
	}
	speechText = strings.ReplaceAll(speechText, "*", "")
	speechText = strings.ReplaceAll(speechText, "#", "")

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-lite-tts:generateContent?key=%s", a.APIKey)
	reqBody := map[string]any{
		"contents": []map[string]any{
			{"parts": []map[string]any{{"text": speechText}}},
		},
		"generationConfig": map[string]any{
			"responseModalities": []string{"AUDIO"},
		},
	}
	bodyBytes, _ := json.Marshal(reqBody)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, "", fmt.Errorf("gemini tts error %d: %s", resp.StatusCode, string(b))
	}

	var res struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					InlineData *struct {
						MimeType string `json:"mimeType"`
						Data     string `json:"data"`
					} `json:"inlineData"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, "", err
	}
	if len(res.Candidates) == 0 || len(res.Candidates[0].Content.Parts) == 0 || res.Candidates[0].Content.Parts[0].InlineData == nil {
		return nil, "", errors.New("no audio in tts response")
	}

	wavBytes, err := base64.StdEncoding.DecodeString(res.Candidates[0].Content.Parts[0].InlineData.Data)
	if err != nil {
		return nil, "", err
	}

	oggBytes, err := encodeWavToOgg(wavBytes)
	if err != nil {
		return nil, "", err
	}
	return oggBytes, "audio/ogg", nil
}

func encodeWavToOgg(wavData []byte) ([]byte, error) {
	gstPath, err := exec.LookPath("gst-launch-1.0")
	if err != nil {
		return nil, fmt.Errorf("gst-launch-1.0 not found: %w", err)
	}

	inF, err := os.CreateTemp("", "tts-*.wav")
	if err != nil {
		return nil, err
	}
	defer os.Remove(inF.Name())

	if _, err := inF.Write(wavData); err != nil {
		inF.Close()
		return nil, err
	}
	inF.Close()

	outPath := inF.Name() + ".ogg"
	defer os.Remove(outPath)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, gstPath,
		"filesrc", "location="+inF.Name(),
		"!", "wavparse",
		"!", "audioconvert",
		"!", "vorbisenc",
		"!", "oggmux",
		"!", "filesink", "location="+outPath,
	)
	if out, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("gst-launch failed: %s (%w)", string(out), err)
	}

	return os.ReadFile(outPath)
}
