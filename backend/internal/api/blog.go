package api

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"chrismoore-decor/backend/internal/models"
	"chrismoore-decor/backend/internal/store"

	"github.com/go-chi/chi/v5"
)

// Blog responses share the catalogue cache version, so any post or
// catalogue change invalidates them. A shorter TTL lets scheduled posts
// appear promptly.
const blogTTL = 5 * time.Minute

func (s *Server) listPosts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := models.BlogFilter{
		Category: q.Get("category"),
		Tag:      q.Get("tag"),
		Query:    q.Get("q"),
		Featured: q.Get("featured") == "true",
		Page:     qInt(r, "page"),
		Limit:    qInt(r, "limit"),
	}
	key := s.cache.CatalogKey(r.Context(), fmt.Sprintf("blog:%s|%s|%s|%t|%d|%d",
		strings.ToLower(f.Category), strings.ToLower(f.Tag), strings.ToLower(strings.TrimSpace(f.Query)), f.Featured, f.Page, f.Limit))
	var page models.BlogPage
	if s.cache.GetJSON(r.Context(), key, &page) {
		w.Header().Set("X-Cache", "HIT")
		writeJSON(w, http.StatusOK, page)
		return
	}
	page, err := s.store.ListPosts(r.Context(), f)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.SetJSON(r.Context(), key, page, blogTTL)
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) blogCategories(w http.ResponseWriter, r *http.Request) {
	key := s.cache.CatalogKey(r.Context(), "blog-categories")
	var out []models.BlogCategory
	if s.cache.GetJSON(r.Context(), key, &out) {
		writeJSON(w, http.StatusOK, out)
		return
	}
	out, err := s.store.BlogCategories(r.Context())
	if err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.SetJSON(r.Context(), key, out, blogTTL)
	writeJSON(w, http.StatusOK, out)
}

type postDetail struct {
	Post     models.BlogPost   `json:"post"`
	Related  []models.BlogPost `json:"related"`
	Products []models.Product  `json:"products"`
}

func (s *Server) getPost(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	key := s.cache.CatalogKey(r.Context(), "post:"+slug)
	var out postDetail
	if s.cache.GetJSON(r.Context(), key, &out) {
		w.Header().Set("X-Cache", "HIT")
		writeJSON(w, http.StatusOK, out)
		return
	}
	p, err := s.store.GetLivePost(r.Context(), slug)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	related, err := s.store.RelatedPosts(r.Context(), p, 3)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	products := []models.Product{}
	if p.ProductCategory != "" {
		page, err := s.store.ListProducts(r.Context(), models.ProductFilter{Category: p.ProductCategory, Sort: "popular", Limit: 4})
		if err == nil {
			products = page.Items
		}
	}
	out = postDetail{Post: p, Related: related, Products: products}
	s.cache.SetJSON(r.Context(), key, out, blogTTL)
	writeJSON(w, http.StatusOK, out)
}

// ---------- Admin ----------

func (s *Server) adminListPosts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, err := s.store.ListPosts(r.Context(), models.BlogFilter{
		Query:              q.Get("q"),
		Status:             q.Get("status"),
		Category:           q.Get("category"),
		Page:               qInt(r, "page"),
		Limit:              qInt(r, "limit"),
		IncludeUnpublished: true,
	})
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) adminGetPost(w http.ResponseWriter, r *http.Request) {
	p, err := s.store.GetPost(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) adminSavePost(w http.ResponseWriter, r *http.Request) {
	var in models.BlogPostInput
	if !decode(w, r, &in) {
		return
	}
	if strings.TrimSpace(in.AuthorName) == "" {
		in.AuthorName = adminFrom(r.Context()).Name
	}
	var (
		p   models.BlogPost
		err error
	)
	id := chi.URLParam(r, "id")
	if id == "" {
		p, err = s.store.CreatePost(r.Context(), in)
	} else {
		p, err = s.store.UpdatePost(r.Context(), id, in)
	}
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			writeError(w, http.StatusConflict, "another post already uses that URL slug")
			return
		}
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	status := http.StatusOK
	if id == "" {
		status = http.StatusCreated
	}
	writeJSON(w, status, p)
}

func (s *Server) adminDeletePost(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeletePost(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	w.WriteHeader(http.StatusNoContent)
}
