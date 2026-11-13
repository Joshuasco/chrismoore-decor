package api

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/mail"
	"slices"
	"strings"
	"time"

	"chrismoore-decor/backend/internal/models"
	"chrismoore-decor/backend/internal/notify"
	"chrismoore-decor/backend/internal/payments"
	"chrismoore-decor/backend/internal/store"
	"chrismoore-decor/backend/internal/whatsapp"

	"github.com/go-chi/chi/v5"
)

const catalogTTL = 10 * time.Minute

func clientIP(r *http.Request) string {
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}

// ---------- Catalogue (Redis read-through) ----------

func (s *Server) publicSettings(w http.ResponseWriter, r *http.Request) {
	key := s.cache.CatalogKey(r.Context(), "settings")
	out := map[string]string{}
	if s.cache.GetJSON(r.Context(), key, &out) {
		w.Header().Set("X-Cache", "HIT")
		writeJSON(w, http.StatusOK, out)
		return
	}
	all, err := s.store.GetSettings(r.Context())
	if err != nil {
		writeStoreError(w, err)
		return
	}
	for _, k := range store.PublicSettingKeys {
		out[k] = all[k]
	}
	out["paystack_enabled"] = fmt.Sprint(s.paystack.Configured())
	out["flutterwave_enabled"] = fmt.Sprint(s.flutterwave.Configured())
	// Which channels customers get their order link on, e.g. "email,sms".
	out["notify_channels"] = strings.Join(s.customers.Active(), ",")
	s.cache.SetJSON(r.Context(), key, out, catalogTTL)
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) listCategories(w http.ResponseWriter, r *http.Request) {
	key := s.cache.CatalogKey(r.Context(), "categories")
	var out []models.Category
	if s.cache.GetJSON(r.Context(), key, &out) {
		w.Header().Set("X-Cache", "HIT")
		writeJSON(w, http.StatusOK, out)
		return
	}
	out, err := s.store.ListCategories(r.Context())
	if err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.SetJSON(r.Context(), key, out, catalogTTL)
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) listProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := models.ProductFilter{
		Category: q.Get("category"),
		Query:    q.Get("q"),
		Sort:     q.Get("sort"),
		Featured: q.Get("featured") == "true",
		MinPrice: qInt64(r, "min"),
		MaxPrice: qInt64(r, "max"),
		Page:     qInt(r, "page"),
		Limit:    qInt(r, "limit"),
	}
	// Normalised key so equivalent queries share a cache entry.
	key := s.cache.CatalogKey(r.Context(), fmt.Sprintf("products:%s|%s|%s|%t|%d|%d|%d|%d",
		f.Category, strings.ToLower(strings.TrimSpace(f.Query)), f.Sort, f.Featured, f.MinPrice, f.MaxPrice, f.Page, f.Limit))
	var page models.ProductPage
	if s.cache.GetJSON(r.Context(), key, &page) {
		w.Header().Set("X-Cache", "HIT")
		writeJSON(w, http.StatusOK, page)
		return
	}
	page, err := s.store.ListProducts(r.Context(), f)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.SetJSON(r.Context(), key, page, catalogTTL)
	writeJSON(w, http.StatusOK, page)
}

type productDetail struct {
	Product models.Product   `json:"product"`
	Related []models.Product `json:"related"`
}

func (s *Server) getProduct(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	key := s.cache.CatalogKey(r.Context(), "product:"+slug)
	var out productDetail
	if s.cache.GetJSON(r.Context(), key, &out) {
		w.Header().Set("X-Cache", "HIT")
		writeJSON(w, http.StatusOK, out)
		return
	}
	p, err := s.store.GetProductBySlug(r.Context(), slug)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	related, err := s.store.RelatedProducts(r.Context(), p, 4)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	out = productDetail{Product: p, Related: related}
	s.cache.SetJSON(r.Context(), key, out, catalogTTL)
	writeJSON(w, http.StatusOK, out)
}

// ---------- Checkout ----------

func validateCheckout(req *models.CheckoutRequest) error {
	req.CustomerName = strings.TrimSpace(req.CustomerName)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Phone = strings.TrimSpace(req.Phone)
	req.Address = strings.TrimSpace(req.Address)
	switch {
	case req.CustomerName == "":
		return errors.New("please enter your full name")
	case req.Phone == "" || len(strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, req.Phone)) < 10:
		return errors.New("please enter a valid phone number")
	case req.Address == "":
		return errors.New("please enter a delivery address")
	case !slices.Contains([]string{"whatsapp", "paystack", "flutterwave"}, req.Channel):
		return errors.New("please choose how you'd like to complete your order")
	case len(req.Items) == 0:
		return errors.New("your cart is empty")
	case len(req.Items) > 50:
		return errors.New("too many items in one order")
	}
	if a, err := mail.ParseAddress(req.Email); err != nil || a.Address != req.Email {
		return errors.New("please enter a valid email address")
	}
	for _, it := range req.Items {
		if it.ProductID == "" || it.Quantity < 1 || it.Quantity > 500 {
			return errors.New("invalid cart item")
		}
	}
	return nil
}

func (s *Server) orderURL(ref string) string { return s.cfg.FrontendURL + "/order/" + ref }

func (s *Server) whatsappLink(ctx context.Context, o models.Order) string {
	settings, _ := s.store.GetSettings(ctx)
	return whatsapp.ChatLink(settings["whatsapp_number"], whatsapp.OrderMessage(o, s.orderURL(o.Reference)))
}

type checkoutResponse struct {
	Order        models.Order `json:"order"`
	WhatsAppURL  string       `json:"whatsapp_url,omitempty"`
	CheckoutURL  string       `json:"checkout_url,omitempty"`
	PaymentError string       `json:"payment_error,omitempty"`
}

func (s *Server) createOrder(w http.ResponseWriter, r *http.Request) {
	if !s.cache.Allow(r.Context(), "order:"+clientIP(r), 20, time.Hour) {
		writeError(w, http.StatusTooManyRequests, "too many orders from this device, please contact us on WhatsApp")
		return
	}
	var req models.CheckoutRequest
	if !decode(w, r, &req) {
		return
	}
	if err := validateCheckout(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.Channel != "whatsapp" && !s.provider(req.Channel).Configured() {
		writeError(w, http.StatusBadRequest, "online payment is not available right now, please order via WhatsApp")
		return
	}
	order, err := s.store.CreateOrder(r.Context(), req)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	go s.notifier.NotifyNewOrder(context.Background(), order, s.cfg.FrontendURL+"/admin/orders/"+order.ID)
	s.customers.Notify(order, notify.EventPlaced)

	resp := checkoutResponse{Order: order}
	if req.Channel == "whatsapp" {
		resp.WhatsAppURL = s.whatsappLink(r.Context(), order)
	} else {
		url, err := s.startPayment(r.Context(), order, req.Channel)
		if err != nil {
			log.Printf("init %s payment for %s: %v", req.Channel, order.Reference, err)
			resp.PaymentError = "we couldn't reach the payment provider — you can retry from your order page or complete on WhatsApp"
		}
		resp.CheckoutURL = url
	}
	writeJSON(w, http.StatusCreated, resp)
}

func (s *Server) startPayment(ctx context.Context, o models.Order, providerName string) (string, error) {
	p := s.provider(providerName)
	if p == nil {
		return "", errors.New("unknown provider")
	}
	if !p.Configured() {
		return "", payments.ErrNotConfigured
	}
	ref := o.Reference + "-" + store.NewReference("", 6)
	if err := s.store.CreatePayment(ctx, o.ID, providerName, ref, o.Total); err != nil {
		return "", err
	}
	return p.Initialize(ctx, payments.InitRequest{
		Reference:   ref,
		AmountKobo:  o.Total,
		Email:       o.Email,
		Phone:       o.Phone,
		Name:        o.CustomerName,
		OrderRef:    o.Reference,
		CallbackURL: fmt.Sprintf("%s/payment/callback?provider=%s&order=%s", s.cfg.FrontendURL, providerName, o.Reference),
	})
}

func (s *Server) getOrder(w http.ResponseWriter, r *http.Request) {
	o, err := s.store.GetOrderByReference(r.Context(), chi.URLParam(r, "reference"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, o)
}

func (s *Server) orderWhatsApp(w http.ResponseWriter, r *http.Request) {
	o, err := s.store.GetOrderByReference(r.Context(), chi.URLParam(r, "reference"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"whatsapp_url": s.whatsappLink(r.Context(), o)})
}

// payOrder lets a shopper (or a WhatsApp customer sent their order link)
// conclude any unpaid order online with Paystack or Flutterwave.
func (s *Server) payOrder(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Provider string `json:"provider"`
	}
	if !decode(w, r, &in) {
		return
	}
	if !s.cache.Allow(r.Context(), "pay:"+clientIP(r), 30, time.Hour) {
		writeError(w, http.StatusTooManyRequests, "too many attempts, please try again later")
		return
	}
	p := s.provider(in.Provider)
	if p == nil {
		writeError(w, http.StatusBadRequest, "choose Paystack or Flutterwave")
		return
	}
	if !p.Configured() {
		writeError(w, http.StatusBadRequest, in.Provider+" is not available right now")
		return
	}
	o, err := s.store.GetOrderByReference(r.Context(), chi.URLParam(r, "reference"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	if o.PaymentStatus == "paid" {
		writeError(w, http.StatusConflict, "this order has already been paid")
		return
	}
	if o.Status == "cancelled" {
		writeError(w, http.StatusConflict, "this order was cancelled — please place a new order")
		return
	}
	url, err := s.startPayment(r.Context(), o, in.Provider)
	if err != nil {
		log.Printf("init %s payment for %s: %v", in.Provider, o.Reference, err)
		writeError(w, http.StatusBadGateway, "we couldn't reach the payment provider, please try again")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"checkout_url": url})
}

// ---------- Payment verification ----------

// confirmPayment re-verifies a payment with its provider (never trusting
// redirect query params or webhook bodies alone) and records the result.
func (s *Server) confirmPayment(ctx context.Context, reference string) (models.Order, bool, error) {
	pay, err := s.store.GetPayment(ctx, reference)
	if err != nil {
		return models.Order{}, false, err
	}
	if pay.Status == "success" {
		o, err := s.store.GetOrderByID(ctx, pay.OrderID)
		return o, true, err
	}
	res, err := s.provider(pay.Provider).Verify(ctx, reference)
	if err != nil {
		return models.Order{}, false, err
	}
	ok := res.Success && strings.EqualFold(res.Currency, "NGN") && res.AmountKobo >= pay.Amount
	if !ok && res.Success {
		log.Printf("payment %s amount/currency mismatch: got %d %s, expected %d NGN", reference, res.AmountKobo, res.Currency, pay.Amount)
	}
	if ok || res.Status == "failed" || (res.Success && !ok) {
		o, newlyPaid, err := s.store.RecordPaymentResult(ctx, reference, ok, res.Raw)
		if err == nil && ok {
			s.cache.InvalidateCatalog(ctx)
		}
		if err == nil && newlyPaid {
			s.customers.Notify(o, notify.EventPaid)
		}
		return o, ok, err
	}
	// Still pending/abandoned at the provider — leave it open for retries.
	o, err := s.store.GetOrderByID(ctx, pay.OrderID)
	return o, false, err
}

func (s *Server) verifyPayment(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	ref := q.Get("reference")
	if ref == "" {
		ref = q.Get("tx_ref")
	}
	if ref == "" {
		writeError(w, http.StatusBadRequest, "missing payment reference")
		return
	}
	out, err := s.confirmAnyPayment(r.Context(), ref)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "payment not found")
			return
		}
		log.Printf("verify payment %s: %v", ref, err)
		writeError(w, http.StatusBadGateway, "we couldn't confirm your payment yet — please refresh in a moment")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) subscribe(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email string `json:"email"`
	}
	if !decode(w, r, &in) {
		return
	}
	if _, err := mail.ParseAddress(strings.TrimSpace(in.Email)); err != nil {
		writeError(w, http.StatusBadRequest, "please enter a valid email address")
		return
	}
	if !s.cache.Allow(r.Context(), "news:"+clientIP(r), 10, time.Hour) {
		writeError(w, http.StatusTooManyRequests, "please try again later")
		return
	}
	if err := s.store.Subscribe(r.Context(), in.Email); err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
