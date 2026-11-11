package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
)

func (s *Server) paystackWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil || !s.paystack.ValidSignature(body, r.Header.Get("x-paystack-signature")) {
		writeError(w, http.StatusUnauthorized, "invalid signature")
		return
	}
	var evt struct {
		Event string `json:"event"`
		Data  struct {
			Reference string `json:"reference"`
		} `json:"data"`
	}
	if json.Unmarshal(body, &evt) == nil && evt.Event == "charge.success" && evt.Data.Reference != "" {
		if _, _, err := s.confirmPayment(r.Context(), evt.Data.Reference); err != nil {
			log.Printf("paystack webhook %s: %v", evt.Data.Reference, err)
		}
	}
	w.WriteHeader(http.StatusOK)
}

func (s *Server) flutterwaveWebhook(w http.ResponseWriter, r *http.Request) {
	if !s.flutterwave.ValidHash(r.Header.Get("verif-hash")) {
		writeError(w, http.StatusUnauthorized, "invalid hash")
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	var evt struct {
		Event string `json:"event"`
		Data  struct {
			TxRef string `json:"tx_ref"`
		} `json:"data"`
		// Older webhook format puts txRef at the top level.
		TxRef string `json:"txRef"`
	}
	if json.Unmarshal(body, &evt) == nil {
		ref := evt.Data.TxRef
		if ref == "" {
			ref = evt.TxRef
		}
		if ref != "" {
			if _, _, err := s.confirmPayment(r.Context(), ref); err != nil {
				log.Printf("flutterwave webhook %s: %v", ref, err)
			}
		}
	}
	w.WriteHeader(http.StatusOK)
}
