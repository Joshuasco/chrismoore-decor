package api

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"chrismoore-decor/backend/internal/models"
	"chrismoore-decor/backend/internal/payments"
	"chrismoore-decor/backend/internal/store"
	"chrismoore-decor/backend/internal/whatsapp"

	"github.com/go-chi/chi/v5"
)

func (s *Server) invoiceURL(token string) string { return s.cfg.FrontendURL + "/invoice/" + token }

// publicInvoice hides internal fields from the customer-facing view.
func publicInvoice(inv models.Invoice) models.Invoice {
	inv.ID = ""
	inv.CreatedByName = ""
	return inv
}

type invoiceDetail struct {
	Invoice     models.Invoice `json:"invoice"`
	InvoiceURL  string         `json:"invoice_url"`
	WhatsAppURL string         `json:"whatsapp_url"`
	EmailURL    string         `json:"email_url"`
}

// invoiceShareLinks builds the payment link plus ready-to-send WhatsApp and
// email messages for the customer.
func (s *Server) invoiceShareLinks(ctx context.Context, inv models.Invoice) invoiceDetail {
	link := s.invoiceURL(inv.Token)
	settings, _ := s.store.GetSettings(ctx)
	storeName := settings["store_name"]
	if storeName == "" {
		storeName = "Chris Moore Interior Decor"
	}
	first := strings.Fields(inv.CustomerName)
	name := "there"
	if len(first) > 0 {
		name = first[0]
	}
	due := ""
	if inv.DueDate != "" {
		if t, err := time.Parse("2006-01-02", inv.DueDate); err == nil {
			due = " (due " + t.Format("2 Jan 2006") + ")"
		}
	}
	msg := fmt.Sprintf("Hello %s, here is your invoice %s from %s for %s%s.\n\nView and pay securely online: %s\n\nThank you!",
		name, inv.Number, storeName, whatsapp.Naira(inv.Total), due, link)
	d := invoiceDetail{Invoice: inv, InvoiceURL: link}
	if inv.Phone != "" {
		d.WhatsAppURL = whatsapp.ChatLink(whatsapp.InternationalPhone(inv.Phone), msg)
	}
	if inv.Email != "" {
		d.EmailURL = "mailto:" + inv.Email + "?subject=" + pathEscape(fmt.Sprintf("Invoice %s from %s", inv.Number, storeName)) +
			"&body=" + pathEscape(msg)
	}
	return d
}

// pathEscape encodes for mailto: links, where spaces must be %20, not "+".
func pathEscape(s string) string {
	var b strings.Builder
	for _, c := range []byte(s) {
		if ('a' <= c && c <= 'z') || ('A' <= c && c <= 'Z') || ('0' <= c && c <= '9') || strings.IndexByte("-_.~", c) >= 0 {
			b.WriteByte(c)
		} else {
			fmt.Fprintf(&b, "%%%02X", c)
		}
	}
	return b.String()
}

// ---------- Admin ----------

func (s *Server) adminListInvoices(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, err := s.store.ListInvoices(r.Context(), models.InvoiceFilter{
		Status: q.Get("status"), Query: q.Get("q"), Page: qInt(r, "page"), Limit: qInt(r, "limit"),
	})
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) adminCreateInvoice(w http.ResponseWriter, r *http.Request) {
	var in models.InvoiceInput
	if !decode(w, r, &in) {
		return
	}
	inv, err := s.store.CreateInvoice(r.Context(), in, adminFrom(r.Context()))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context()) // stock changed
	writeJSON(w, http.StatusCreated, s.invoiceShareLinks(r.Context(), inv))
}

func (s *Server) adminGetInvoice(w http.ResponseWriter, r *http.Request) {
	inv, err := s.store.GetInvoice(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s.invoiceShareLinks(r.Context(), inv))
}

func (s *Server) adminUpdateInvoice(w http.ResponseWriter, r *http.Request) {
	var in models.InvoiceInput
	if !decode(w, r, &in) {
		return
	}
	inv, err := s.store.UpdateInvoice(r.Context(), chi.URLParam(r, "id"), in, adminFrom(r.Context()).Email)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	writeJSON(w, http.StatusOK, s.invoiceShareLinks(r.Context(), inv))
}

func (s *Server) adminSetInvoiceStatus(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Status string `json:"status"`
	}
	if !decode(w, r, &in) {
		return
	}
	if in.Status != "paid" && in.Status != "unpaid" && in.Status != "void" {
		writeError(w, http.StatusBadRequest, "status must be paid, unpaid or void")
		return
	}
	inv, err := s.store.SetInvoiceStatus(r.Context(), chi.URLParam(r, "id"), in.Status, adminFrom(r.Context()).Email)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	writeJSON(w, http.StatusOK, s.invoiceShareLinks(r.Context(), inv))
}

func (s *Server) adminDeleteInvoice(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteInvoice(r.Context(), chi.URLParam(r, "id"), adminFrom(r.Context()).Email); err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	w.WriteHeader(http.StatusNoContent)
}

// ---------- Public (customer) ----------

func (s *Server) getInvoice(w http.ResponseWriter, r *http.Request) {
	inv, err := s.store.GetInvoiceByToken(r.Context(), chi.URLParam(r, "token"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, publicInvoice(inv))
}

// payInvoice starts an online payment for an unpaid invoice. If the invoice
// has no email (providers require one), the customer supplies it.
func (s *Server) payInvoice(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Provider string `json:"provider"`
		Email    string `json:"email"`
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
	inv, err := s.store.GetInvoiceByToken(r.Context(), chi.URLParam(r, "token"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	switch inv.Status {
	case "paid":
		writeError(w, http.StatusConflict, "this invoice has already been paid")
		return
	case "void":
		writeError(w, http.StatusConflict, "this invoice has been cancelled — please contact us")
		return
	}
	email := inv.Email
	if email == "" {
		email = strings.ToLower(strings.TrimSpace(in.Email))
		if a, err := mail.ParseAddress(email); err != nil || a.Address != email {
			writeError(w, http.StatusBadRequest, "enter your email address to pay online")
			return
		}
		if err := s.store.SetInvoiceEmail(r.Context(), inv.ID, email); err != nil {
			log.Printf("save invoice email %s: %v", inv.Number, err)
		}
	}
	ref := inv.Number + "-" + store.NewReference("", 6)
	if err := s.store.CreateInvoicePayment(r.Context(), inv.ID, in.Provider, ref, inv.Total); err != nil {
		writeStoreError(w, err)
		return
	}
	url, err := p.Initialize(r.Context(), payments.InitRequest{
		Reference:   ref,
		AmountKobo:  inv.Total,
		Email:       email,
		Phone:       inv.Phone,
		Name:        inv.CustomerName,
		OrderRef:    inv.Number,
		Description: "Invoice " + inv.Number,
		CallbackURL: fmt.Sprintf("%s/payment/callback?provider=%s&invoice=%s", s.cfg.FrontendURL, in.Provider, inv.Token),
	})
	if err != nil {
		log.Printf("init %s payment for %s: %v", in.Provider, inv.Number, err)
		writeError(w, http.StatusBadGateway, "we couldn't reach the payment provider, please try again")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"checkout_url": url})
}

// confirmInvoicePayment re-verifies an invoice payment with its provider
// and records the result, mirroring confirmPayment for orders.
func (s *Server) confirmInvoicePayment(ctx context.Context, pay models.Payment) (models.Invoice, bool, error) {
	if pay.Status == "success" {
		inv, err := s.store.GetInvoice(ctx, pay.InvoiceID)
		return inv, true, err
	}
	res, err := s.provider(pay.Provider).Verify(ctx, pay.Reference)
	if err != nil {
		return models.Invoice{}, false, err
	}
	ok := res.Success && strings.EqualFold(res.Currency, "NGN") && res.AmountKobo >= pay.Amount
	if !ok && res.Success {
		log.Printf("payment %s amount/currency mismatch: got %d %s, expected %d NGN", pay.Reference, res.AmountKobo, res.Currency, pay.Amount)
	}
	if ok || res.Status == "failed" || (res.Success && !ok) {
		inv, newlyPaid, err := s.store.RecordInvoicePaymentResult(ctx, pay.Reference, ok, res.Raw)
		if err == nil && newlyPaid {
			s.cache.InvalidateCatalog(ctx)
			go s.notifier.NotifyText(context.Background(), fmt.Sprintf("💳 Invoice %s paid: %s by %s (%s)",
				inv.Number, whatsapp.Naira(inv.Total), inv.CustomerName, pay.Provider))
		}
		return inv, ok, err
	}
	inv, err := s.store.GetInvoice(ctx, pay.InvoiceID)
	return inv, false, err
}

// paymentOutcome is the result of verifying any payment reference.
type paymentOutcome struct {
	Verified bool            `json:"verified"`
	Order    *models.Order   `json:"order,omitempty"`
	Invoice  *models.Invoice `json:"invoice,omitempty"`
}

// confirmAnyPayment verifies a payment reference for an order or invoice.
func (s *Server) confirmAnyPayment(ctx context.Context, reference string) (paymentOutcome, error) {
	pay, err := s.store.GetPayment(ctx, reference)
	if err != nil {
		return paymentOutcome{}, err
	}
	if pay.InvoiceID != "" {
		inv, ok, err := s.confirmInvoicePayment(ctx, pay)
		if err != nil {
			return paymentOutcome{}, err
		}
		pub := publicInvoice(inv)
		return paymentOutcome{Verified: ok, Invoice: &pub}, nil
	}
	o, ok, err := s.confirmPayment(ctx, reference)
	if err != nil {
		return paymentOutcome{}, err
	}
	return paymentOutcome{Verified: ok, Order: &o}, nil
}
