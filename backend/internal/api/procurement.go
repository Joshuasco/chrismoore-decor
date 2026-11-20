package api

import (
	"net/http"

	"chrismoore-decor/backend/internal/models"

	"github.com/go-chi/chi/v5"
)

// ---------- Procurement Stats ----------

func (s *Server) adminProcurementStats(w http.ResponseWriter, r *http.Request) {
	st, err := s.store.ProcurementStats(r.Context())
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, st)
}

// ---------- Suppliers ----------

func (s *Server) adminListSuppliers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	var isActive *bool
	if activeStr := q.Get("is_active"); activeStr != "" {
		b := activeStr == "true"
		isActive = &b
	}
	page, err := s.store.ListSuppliers(r.Context(), models.SupplierFilter{
		Query:    q.Get("q"),
		IsActive: isActive,
		Page:     qInt(r, "page"),
		Limit:    qInt(r, "limit"),
	})
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) adminCreateSupplier(w http.ResponseWriter, r *http.Request) {
	var in models.SupplierInput
	if !decode(w, r, &in) {
		return
	}
	sup, err := s.store.CreateSupplier(r.Context(), in)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, sup)
}

func (s *Server) adminGetSupplier(w http.ResponseWriter, r *http.Request) {
	sup, err := s.store.GetSupplier(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sup)
}

func (s *Server) adminUpdateSupplier(w http.ResponseWriter, r *http.Request) {
	var in models.SupplierInput
	if !decode(w, r, &in) {
		return
	}
	sup, err := s.store.UpdateSupplier(r.Context(), chi.URLParam(r, "id"), in)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sup)
}

func (s *Server) adminDeleteSupplier(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteSupplier(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// ---------- Purchase Orders ----------

func (s *Server) adminListPurchaseOrders(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, err := s.store.ListPurchaseOrders(r.Context(), models.PurchaseOrderFilter{
		SupplierID:    q.Get("supplier_id"),
		Status:        q.Get("status"),
		PaymentStatus: q.Get("payment_status"),
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

func (s *Server) adminCreatePurchaseOrder(w http.ResponseWriter, r *http.Request) {
	var in models.PurchaseOrderInput
	if !decode(w, r, &in) {
		return
	}
	u := adminFrom(r.Context())
	var creatorID *string
	if u.ID != "" {
		creatorID = &u.ID
	}
	creatorName := u.Name
	if creatorName == "" {
		creatorName = u.Email
	}

	po, err := s.store.CreatePurchaseOrder(r.Context(), in, creatorID, creatorName)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, po)
}

func (s *Server) adminGetPurchaseOrder(w http.ResponseWriter, r *http.Request) {
	po, err := s.store.GetPurchaseOrder(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, po)
}

func (s *Server) adminUpdatePurchaseOrder(w http.ResponseWriter, r *http.Request) {
	var in models.PurchaseOrderInput
	if !decode(w, r, &in) {
		return
	}
	po, err := s.store.UpdatePurchaseOrder(r.Context(), chi.URLParam(r, "id"), in)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, po)
}

type statusChangeInput struct {
	Status string `json:"status"`
}

func (s *Server) adminSetPurchaseOrderStatus(w http.ResponseWriter, r *http.Request) {
	var in statusChangeInput
	if !decode(w, r, &in) {
		return
	}
	po, err := s.store.SetPurchaseOrderStatus(r.Context(), chi.URLParam(r, "id"), in.Status)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, po)
}

func (s *Server) adminDeletePurchaseOrder(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeletePurchaseOrder(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// ---------- Goods Receipt ----------

func (s *Server) adminReceiveGoods(w http.ResponseWriter, r *http.Request) {
	var in models.ReceiveGoodsInput
	if !decode(w, r, &in) {
		return
	}
	u := adminFrom(r.Context())
	actor := u.Email
	if actor == "" {
		actor = "admin"
	}

	po, err := s.store.ReceiveGoods(r.Context(), chi.URLParam(r, "id"), in, actor)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	s.cache.InvalidateCatalog(r.Context())
	writeJSON(w, http.StatusOK, po)
}

// ---------- Supplier Payments ----------

func (s *Server) adminRecordProcurementPayment(w http.ResponseWriter, r *http.Request) {
	var in models.ProcurementPaymentInput
	if !decode(w, r, &in) {
		return
	}
	u := adminFrom(r.Context())
	creatorName := u.Name
	if creatorName == "" {
		creatorName = u.Email
	}

	po, err := s.store.RecordProcurementPayment(r.Context(), chi.URLParam(r, "id"), in, creatorName)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, po)
}
