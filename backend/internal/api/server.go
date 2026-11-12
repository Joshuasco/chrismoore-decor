// Package api wires the HTTP routes for the storefront and admin dashboard.
package api

import (
	"context"
	"log"
	"net/http"
	"time"

	"chrismoore-decor/backend/internal/cache"
	"chrismoore-decor/backend/internal/config"
	"chrismoore-decor/backend/internal/notify"
	"chrismoore-decor/backend/internal/payments"
	"chrismoore-decor/backend/internal/storage"
	"chrismoore-decor/backend/internal/store"
	"chrismoore-decor/backend/internal/whatsapp"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

type Server struct {
	cfg         config.Config
	store       *store.Store
	cache       *cache.Cache
	paystack    *payments.Paystack
	flutterwave *payments.Flutterwave
	notifier    whatsapp.Notifier
	customers   *notify.Service
	uploads     storage.Supabase
}

func NewServer(cfg config.Config, st *store.Store, c *cache.Cache) *Server {
	s := &Server{
		cfg:         cfg,
		store:       st,
		cache:       c,
		paystack:    payments.NewPaystack(cfg.PaystackSecretKey),
		flutterwave: payments.NewFlutterwave(cfg.FlutterwaveSecretKey, cfg.FlutterwaveSecretHash),
		notifier: whatsapp.Notifier{
			Token:         cfg.WhatsAppToken,
			PhoneNumberID: cfg.WhatsAppPhoneNumberID,
			NotifyTo:      cfg.WhatsAppNotifyTo,
		},
		uploads: storage.Supabase{
			URL:        cfg.SupabaseURL,
			ServiceKey: cfg.SupabaseServiceRoleKey,
			Bucket:     cfg.SupabaseBucket,
		},
	}
	s.customers = &notify.Service{
		Recorder: st,
		Channels: []notify.Channel{
			notify.SMTP{
				Host: cfg.SMTPHost, Port: cfg.SMTPPort, Username: cfg.SMTPUsername, Password: cfg.SMTPPassword,
				From: cfg.EmailFrom, ReplyTo: cfg.EmailReplyTo,
			},
			notify.Termii{APIKey: cfg.TermiiAPIKey, SenderID: cfg.TermiiSenderID, BaseURL: cfg.TermiiBaseURL, Route: cfg.TermiiChannel},
			notify.WhatsAppTemplate{
				Token: cfg.WhatsAppToken, PhoneNumberID: cfg.WhatsAppPhoneNumberID,
				Template: cfg.WhatsAppCustomerTemplate, Language: cfg.WhatsAppTemplateLang,
			},
		},
		StoreInfo: s.storeInfo,
		OrderURL:  s.orderURL,
	}
	return s
}

func (s *Server) storeInfo(ctx context.Context) notify.StoreInfo {
	st, err := s.store.GetSettings(ctx)
	if err != nil {
		return notify.StoreInfo{}
	}
	return notify.StoreInfo{
		Name:     st["store_name"],
		Phone:    st["contact_phone"],
		WhatsApp: st["whatsapp_number"],
		Email:    st["contact_email"],
	}
}

// RunJanitor cancels unpaid online orders after 3 hours, every 15 minutes,
// so their reserved stock goes back on sale, and tells those customers.
func (s *Server) RunJanitor(ctx context.Context) {
	t := time.NewTicker(15 * time.Minute)
	defer t.Stop()
	for {
		ids, err := s.store.ExpireStaleOrders(ctx, 3*time.Hour)
		if err != nil {
			log.Printf("expire orders: %v", err)
		}
		if len(ids) > 0 {
			s.cache.InvalidateCatalog(ctx)
			log.Printf("expired %d unpaid orders", len(ids))
			for _, id := range ids {
				if o, err := s.store.GetOrderByID(ctx, id); err == nil {
					s.customers.Notify(o, notify.EventCancelled)
				}
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// Drain waits briefly for customer messages still being sent.
func (s *Server) Drain(timeout time.Duration) { s.customers.Wait(timeout) }

func (s *Server) provider(name string) payments.Provider {
	switch name {
	case "paystack":
		return s.paystack
	case "flutterwave":
		return s.flutterwave
	}
	return nil
}

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   s.cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "cache": s.cache.Enabled()})
	})

	if s.cfg.DocsEnabled {
		r.Get("/docs", serveSwaggerUI)
		r.Get("/openapi.yaml", serveOpenAPI)
	}

	r.Route("/api", func(r chi.Router) {
		// Storefront
		r.Get("/settings", s.publicSettings)
		r.Get("/categories", s.listCategories)
		r.Get("/products", s.listProducts)
		r.Get("/products/{slug}", s.getProduct)
		r.Get("/products/{slug}/reviews", s.listReviews)
		r.Post("/products/{slug}/reviews", s.createReview)
		r.Post("/orders", s.createOrder)
		r.Get("/orders/{reference}", s.getOrder)
		r.Post("/orders/{reference}/pay", s.payOrder)
		r.Get("/orders/{reference}/whatsapp", s.orderWhatsApp)
		r.Get("/payments/verify", s.verifyPayment)
		r.Post("/newsletter", s.subscribe)
		r.Get("/blog", s.listPosts)
		r.Get("/blog/categories", s.blogCategories)
		r.Get("/blog/{slug}", s.getPost)

		// Provider webhooks
		r.Post("/webhooks/paystack", s.paystackWebhook)
		r.Post("/webhooks/flutterwave", s.flutterwaveWebhook)

		// Admin dashboard
		r.Post("/admin/login", s.login)
		r.Route("/admin", func(r chi.Router) {
			r.Use(s.requireAdmin)
			r.Get("/me", s.me)
			r.Post("/password", s.changePassword)
			r.Get("/stats", s.stats)

			r.Get("/products", s.adminListProducts)
			r.Post("/products", s.adminCreateProduct)
			r.Get("/products/{id}", s.adminGetProduct)
			r.Put("/products/{id}", s.adminUpdateProduct)
			r.Delete("/products/{id}", s.adminDeleteProduct)
			r.Post("/products/{id}/stock", s.adminAdjustStock)

			r.Get("/categories", s.listCategories)
			r.Post("/categories", s.adminCreateCategory)
			r.Put("/categories/{id}", s.adminUpdateCategory)
			r.Delete("/categories/{id}", s.adminDeleteCategory)

			r.Get("/inventory/movements", s.adminMovements)

			r.Get("/orders", s.adminListOrders)
			r.Get("/orders/{id}", s.adminGetOrder)
			r.Patch("/orders/{id}", s.adminUpdateOrder)
			r.Post("/orders/{id}/verify-payment", s.adminVerifyOrderPayment)
			r.Post("/orders/{id}/notify", s.adminNotifyCustomer)

			r.Get("/settings", s.adminSettings)
			r.Put("/settings", s.adminUpdateSettings)
			r.Get("/blog", s.adminListPosts)
			r.Post("/blog", s.adminSavePost)
			r.Get("/blog/{id}", s.adminGetPost)
			r.Put("/blog/{id}", s.adminSavePost)
			r.Delete("/blog/{id}", s.adminDeletePost)

			r.Get("/reviews", s.adminListReviews)
			r.Patch("/reviews/{id}", s.adminUpdateReview)
			r.Delete("/reviews/{id}", s.adminDeleteReview)

			r.Get("/subscribers", s.adminSubscribers)
			r.Post("/uploads", s.adminUpload)
		})
	})
	return r
}
