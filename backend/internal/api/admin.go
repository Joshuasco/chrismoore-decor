package api

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"path"
	"strings"
	"time"

	"chrismoore-decor/backend/internal/models"
	"chrismoore-decor/backend/internal/storage"
	"chrismoore-decor/backend/internal/store"
	"chrismoore-decor/backend/internal/whatsapp"

	"github.com/go-chi/chi/v5"
)

func (s *Server) stats(w http.ResponseWriter, r *http.Request) {
	st, err := s.store.Stats(r.Context())
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, st)
}

// ---------- Products ----------

func (s *Server) adminListProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, err := s.store.ListProducts(r.Context(), models.ProductFilter{
		Category:        q.Get("category"),
		Query:           q.Get("q"),
		Sort:            q.Get("sort"),
		Page:            qInt(r, "page"),
		Limit:           qInt(r, "limit"),
		IncludeInactive: true,
		LowStockOnly:    q.Get("low_stock") == "true",
	})
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) adminGetProduct(w http.ResponseWriter, r *http.Request) {
	p, err := s.store.GetProduct(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) adminCreateProduct(w http.ResponseWriter, r *http.Request) {
	var in models.ProductInput
	if !decode(w, r, &in) {
		return
	}
	p, err := s.store.CreateProduct(r.Context(), in, adminFrom(r.Context()).Email)
	if err != nil {
		if err == store.ErrInvalid { // bare error: missing required fields; wrapped ones carry their own message
			writeError(w, http.StatusBadRequest, "name, SKU and a non-negative price and stock are required")
			return
		}
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	writeJSON(w, http.StatusCreated, p)
}

func (s *Server) adminUpdateProduct(w http.ResponseWriter, r *http.Request) {
	var in models.ProductInput
	if !decode(w, r, &in) {
		return
	}
	p, err := s.store.UpdateProduct(r.Context(), chi.URLParam(r, "id"), in, adminFrom(r.Context()).Email)
	if err != nil {
		if err == store.ErrInvalid { // bare error: missing required fields; wrapped ones carry their own message
			writeError(w, http.StatusBadRequest, "name, SKU and a non-negative price and stock are required")
			return
		}
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) adminDeleteProduct(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteProduct(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) adminAdjustStock(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Change int    `json:"change"`
		Reason string `json:"reason"`
	}
	if !decode(w, r, &in) {
		return
	}
	p, err := s.store.AdjustStock(r.Context(), chi.URLParam(r, "id"), in.Change, in.Reason, adminFrom(r.Context()).Email)
	if err != nil {
		if errors.Is(err, store.ErrInvalid) {
			writeError(w, http.StatusBadRequest, "enter a non-zero quantity and a reason")
			return
		}
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) adminMovements(w http.ResponseWriter, r *http.Request) {
	m, err := s.store.ListMovements(r.Context(), r.URL.Query().Get("product_id"), qInt(r, "limit"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, m)
}

// ---------- Categories ----------

func (s *Server) adminCreateCategory(w http.ResponseWriter, r *http.Request) {
	var in models.CategoryInput
	if !decode(w, r, &in) {
		return
	}
	if strings.TrimSpace(in.Name) == "" {
		writeError(w, http.StatusBadRequest, "category name is required")
		return
	}
	c, err := s.store.CreateCategory(r.Context(), in)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	writeJSON(w, http.StatusCreated, c)
}

func (s *Server) adminUpdateCategory(w http.ResponseWriter, r *http.Request) {
	var in models.CategoryInput
	if !decode(w, r, &in) {
		return
	}
	if strings.TrimSpace(in.Name) == "" {
		writeError(w, http.StatusBadRequest, "category name is required")
		return
	}
	c, err := s.store.UpdateCategory(r.Context(), chi.URLParam(r, "id"), in)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	writeJSON(w, http.StatusOK, c)
}

func (s *Server) adminDeleteCategory(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteCategory(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	w.WriteHeader(http.StatusNoContent)
}

// ---------- Orders ----------

func (s *Server) adminListOrders(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, err := s.store.ListOrders(r.Context(), models.OrderFilter{
		Status:        q.Get("status"),
		PaymentStatus: q.Get("payment_status"),
		Channel:       q.Get("channel"),
		Query:         q.Get("q"),
		Page:          qInt(r, "page"),
		Limit:         qInt(r, "limit"),
	})
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) adminGetOrder(w http.ResponseWriter, r *http.Request) {
	o, err := s.store.GetOrderByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"order":        o,
		"whatsapp_url": s.customerChatLink(o),
		"order_url":    s.orderURL(o.Reference),
	})
}

// customerChatLink opens a chat with the customer, pre-filled with their
// order link so the owner can send it for online payment.
func (s *Server) customerChatLink(o models.Order) string {
	phone := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, o.Phone)
	if strings.HasPrefix(phone, "0") && len(phone) == 11 {
		phone = "234" + phone[1:] // Nigerian local format -> international
	}
	msg := fmt.Sprintf("Hello %s, thank you for your order %s with Chris Moore Interior Decor. "+
		"You can review it and pay securely online here: %s", o.CustomerName, o.Reference, s.orderURL(o.Reference))
	return whatsapp.ChatLink(phone, msg)
}

func (s *Server) adminUpdateOrder(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Status        string `json:"status"`
		PaymentStatus string `json:"payment_status"`
	}
	if !decode(w, r, &in) {
		return
	}
	o, err := s.store.UpdateOrderStatus(r.Context(), chi.URLParam(r, "id"), in.Status, in.PaymentStatus, adminFrom(r.Context()).Email)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	writeJSON(w, http.StatusOK, o)
}

// adminVerifyOrderPayment re-checks the order's latest online payment with
// the provider — useful if a webhook was missed.
func (s *Server) adminVerifyOrderPayment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var ref string
	err := s.store.DB().QueryRow(r.Context(),
		`select reference from payments where order_id=$1 order by created_at desc limit 1`, id).Scan(&ref)
	if err != nil {
		writeError(w, http.StatusNotFound, "no online payment attempt found for this order")
		return
	}
	o, ok, err := s.confirmPayment(r.Context(), ref)
	if err != nil {
		log.Printf("admin verify %s: %v", ref, err)
		writeError(w, http.StatusBadGateway, "could not reach the payment provider")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"verified": ok, "order": o})
}

// ---------- Settings, subscribers, uploads ----------

func (s *Server) adminSettings(w http.ResponseWriter, r *http.Request) {
	st, err := s.store.GetSettings(r.Context())
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"settings": st,
		"integrations": map[string]bool{
			"paystack":      s.paystack.Configured(),
			"flutterwave":   s.flutterwave.Configured(),
			"whatsapp_api":  s.notifier.Enabled(),
			"image_uploads": s.uploads.Configured(),
			"redis":         s.cache.Enabled(),
		},
	})
}

func (s *Server) adminUpdateSettings(w http.ResponseWriter, r *http.Request) {
	in := map[string]string{}
	if !decode(w, r, &in) {
		return
	}
	if err := s.store.UpdateSettings(r.Context(), in); err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	s.adminSettings(w, r)
}

func (s *Server) adminSubscribers(w http.ResponseWriter, r *http.Request) {
	subs, err := s.store.ListSubscribers(r.Context())
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, subs)
}

var imageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/avif": ".avif",
}

func (s *Server) adminUpload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 6<<20)
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "upload an image up to 5 MB")
		return
	}
	defer file.Close()

	sniff := make([]byte, 512)
	n, _ := file.Read(sniff)
	ctype := http.DetectContentType(sniff[:n])
	ext, ok := imageTypes[ctype]
	if !ok {
		writeError(w, http.StatusBadRequest, "only JPEG, PNG, WebP or AVIF images are allowed")
		return
	}
	if _, err := file.Seek(0, 0); err != nil {
		writeStoreError(w, err)
		return
	}
	base := store.Slugify(strings.TrimSuffix(header.Filename, path.Ext(header.Filename)))
	if base == "" {
		base = "image"
	}
	objectPath := fmt.Sprintf("products/%s/%s-%s%s", time.Now().Format("2006-01"), base, strings.ToLower(store.NewReference("", 6)), ext)
	url, err := s.uploads.Upload(r.Context(), objectPath, ctype, file)
	if err != nil {
		if errors.Is(err, storage.ErrNotConfigured) {
			writeError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		log.Printf("upload: %v", err)
		writeError(w, http.StatusBadGateway, "image upload failed")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"url": url})
}
