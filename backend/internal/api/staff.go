package api

import (
	"errors"
	"net/http"

	"chrismoore-decor/backend/internal/models"
	"chrismoore-decor/backend/internal/store"

	"github.com/go-chi/chi/v5"
)

// ---------- Staff accounts (admins only) ----------

func (s *Server) adminListStaff(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	switch status {
	case "", "pending", "approved", "disapproved":
	default:
		writeError(w, http.StatusBadRequest, "status must be pending, approved or disapproved")
		return
	}
	users, err := s.store.ListUsers(r.Context(), status)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": users})
}

func (s *Server) adminUpdateStaff(w http.ResponseWriter, r *http.Request) {
	var in models.StaffUpdate
	if !decode(w, r, &in) {
		return
	}
	u, err := s.store.UpdateStaff(r.Context(), chi.URLParam(r, "id"), adminFrom(r.Context()).ID, in)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (s *Server) adminDeleteStaff(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteStaff(r.Context(), chi.URLParam(r, "id"), adminFrom(r.Context()).ID); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---------- Staff groups (admins only) ----------

func (s *Server) adminListGroups(w http.ResponseWriter, r *http.Request) {
	groups, err := s.store.ListGroups(r.Context())
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": groups, "permissions": models.Permissions})
}

func (s *Server) adminSaveGroup(w http.ResponseWriter, r *http.Request) {
	var in models.StaffGroupInput
	if !decode(w, r, &in) {
		return
	}
	id := chi.URLParam(r, "id")
	status := http.StatusOK
	if id == "" {
		status = http.StatusCreated
	}
	id, err := s.store.SaveGroup(r.Context(), id, in)
	if errors.Is(err, store.ErrConflict) {
		writeError(w, http.StatusConflict, "a group with that name already exists")
		return
	}
	if err != nil {
		writeStoreError(w, err)
		return
	}
	groups, err := s.store.ListGroups(r.Context())
	if err != nil {
		writeStoreError(w, err)
		return
	}
	for _, g := range groups {
		if g.ID == id {
			writeJSON(w, status, g)
			return
		}
	}
	writeError(w, http.StatusNotFound, "not found")
}

func (s *Server) adminDeleteGroup(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteGroup(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
