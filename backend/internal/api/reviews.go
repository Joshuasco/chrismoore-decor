package api

import (
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"chrismoore-decor/backend/internal/models"
	"chrismoore-decor/backend/internal/store"

	"github.com/go-chi/chi/v5"
)

func (s *Server) listReviews(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	f := models.ReviewFilter{Rating: qInt(r, "rating"), Sort: r.URL.Query().Get("sort"), Page: qInt(r, "page"), Limit: qInt(r, "limit")}
	key := s.cache.CatalogKey(r.Context(), fmt.Sprintf("reviews:%s|%d|%s|%d|%d", slug, f.Rating, f.Sort, f.Page, f.Limit))
	var page models.ReviewPage
	if s.cache.GetJSON(r.Context(), key, &page) {
		w.Header().Set("X-Cache", "HIT")
		writeJSON(w, http.StatusOK, page)
		return
	}
	p, err := s.store.GetProductBySlug(r.Context(), slug)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	page, err = s.store.ListReviews(r.Context(), p.ID, f)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.SetJSON(r.Context(), key, page, catalogTTL)
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) createReview(w http.ResponseWriter, r *http.Request) {
	var in models.ReviewInput
	if !decode(w, r, &in) {
		return
	}
	accepted := map[string]string{"status": "pending", "message": "Thanks for your review! It will appear once our team has approved it."}
	if in.Website != "" { // honeypot tripped: pretend success, store nothing
		writeJSON(w, http.StatusCreated, accepted)
		return
	}
	if !s.cache.Allow(r.Context(), "review:"+clientIP(r), 5, time.Hour) {
		writeError(w, http.StatusTooManyRequests, "you've sent several reviews already — please try again later")
		return
	}
	if _, err := mail.ParseAddress(strings.TrimSpace(in.Email)); err != nil {
		writeError(w, http.StatusBadRequest, "please enter a valid email address (it won't be published)")
		return
	}
	p, err := s.store.GetProductBySlug(r.Context(), chi.URLParam(r, "slug"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	if err := s.store.CreateReview(r.Context(), p.ID, in); err != nil {
		if errors.Is(err, store.ErrConflict) {
			writeError(w, http.StatusConflict, "you've already reviewed this product — thank you!")
			return
		}
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, accepted)
}

func (s *Server) adminListReviews(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, err := s.store.AdminListReviews(r.Context(), models.ReviewFilter{
		Status: q.Get("status"), Rating: qInt(r, "rating"), Query: q.Get("q"), Page: qInt(r, "page"), Limit: qInt(r, "limit"),
	})
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) adminUpdateReview(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Status string `json:"status"`
	}
	if !decode(w, r, &in) {
		return
	}
	if err := s.store.SetReviewStatus(r.Context(), chi.URLParam(r, "id"), in.Status); err != nil {
		writeStoreError(w, err)
		return
	}
	// The product's rating/review_count changed: refresh cards, pages and review lists.
	s.cache.InvalidateCatalog(r.Context())
	writeJSON(w, http.StatusOK, map[string]string{"status": in.Status})
}

func (s *Server) adminDeleteReview(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteReview(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	w.WriteHeader(http.StatusNoContent)
}
