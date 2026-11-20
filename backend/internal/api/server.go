// Package api wires the HTTP routes for the storefront and admin dashboard.
package api

import (
	"context"
	"log"
	"net/http"
	"time"

	"chrismoore-decor/backend/internal/ai"
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
	assistant   *ai.Assistant
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
		assistant: ai.New(cfg.GeminiAPIKey, cfg.GeminiModel, st, cfg.FrontendURL, cfg.WhatsAppVoiceReply),
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
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "cache": s.cache.Up()})
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
		r.Get("/invoices/{token}", s.getInvoice)
		r.Post("/invoices/{token}/pay", s.payInvoice)

		// Provider webhooks
		r.Post("/webhooks/paystack", s.paystackWebhook)
		r.Post("/webhooks/flutterwave", s.flutterwaveWebhook)
		r.Get("/webhooks/whatsapp", s.verifyWhatsAppWebhook)
		r.Post("/webhooks/whatsapp", s.handleWhatsAppWebhook)

		// Admin dashboard. Every signed-in route checks that the account is
		// approved; each section also needs its service (admins have all).
		r.Post("/admin/login", s.login)
		r.Post("/admin/register", s.register)
		r.Route("/admin", func(r chi.Router) {
			r.Use(s.requireAdmin)
			r.Get("/me", s.me)
			r.Post("/password", s.changePassword)

			r.With(requirePerm("dashboard:read", "dashboard")).Get("/stats", s.stats)

			// Product lists are also needed to pick items for stock moves, invoices and procurement.
			r.With(requirePerm("products:read", "products", "inventory:read", "inventory", "invoices:read", "invoices", "procurement:read", "procurement")).Get("/products", s.adminListProducts)
			r.With(requirePerm("products:read", "products", "inventory:read", "inventory", "invoices:read", "invoices", "procurement:read", "procurement")).Get("/products/{id}", s.adminGetProduct)
			r.With(requirePerm("products:read", "products", "blog:read", "blog")).Get("/categories", s.listCategories)
			r.With(requirePerm("products:create", "products:update", "products", "blog:create", "blog:update", "blog")).Post("/uploads", s.adminUpload)
			r.Group(func(r chi.Router) {
				r.With(requirePerm("products:create", "products")).Post("/products", s.adminCreateProduct)
				r.With(requirePerm("products:update", "products")).Put("/products/{id}", s.adminUpdateProduct)
				r.With(requirePerm("products:delete", "products")).Delete("/products/{id}", s.adminDeleteProduct)
				r.With(requirePerm("products:create", "products")).Post("/categories", s.adminCreateCategory)
				r.With(requirePerm("products:update", "products")).Put("/categories/{id}", s.adminUpdateCategory)
				r.With(requirePerm("products:delete", "products")).Delete("/categories/{id}", s.adminDeleteCategory)
			})

			r.Group(func(r chi.Router) {
				r.With(requirePerm("inventory:update", "inventory")).Post("/products/{id}/stock", s.adminAdjustStock)
				r.With(requirePerm("inventory:read", "inventory")).Get("/inventory/movements", s.adminMovements)
			})

			r.Group(func(r chi.Router) {
				r.With(requirePerm("procurement:read", "procurement")).Get("/procurement/stats", s.adminProcurementStats)
				r.With(requirePerm("procurement:read", "procurement")).Get("/suppliers", s.adminListSuppliers)
				r.With(requirePerm("procurement:create", "procurement")).Post("/suppliers", s.adminCreateSupplier)
				r.With(requirePerm("procurement:read", "procurement")).Get("/suppliers/{id}", s.adminGetSupplier)
				r.With(requirePerm("procurement:update", "procurement")).Put("/suppliers/{id}", s.adminUpdateSupplier)
				r.With(requirePerm("procurement:delete", "procurement")).Delete("/suppliers/{id}", s.adminDeleteSupplier)

				r.With(requirePerm("procurement:read", "procurement")).Get("/purchase-orders", s.adminListPurchaseOrders)
				r.With(requirePerm("procurement:create", "procurement")).Post("/purchase-orders", s.adminCreatePurchaseOrder)
				r.With(requirePerm("procurement:read", "procurement")).Get("/purchase-orders/{id}", s.adminGetPurchaseOrder)
				r.With(requirePerm("procurement:update", "procurement")).Put("/purchase-orders/{id}", s.adminUpdatePurchaseOrder)
				r.With(requirePerm("procurement:update", "procurement")).Patch("/purchase-orders/{id}/status", s.adminSetPurchaseOrderStatus)
				r.With(requirePerm("procurement:delete", "procurement")).Delete("/purchase-orders/{id}", s.adminDeletePurchaseOrder)
				r.With(requirePerm("procurement:receive", "procurement:update", "procurement")).Post("/purchase-orders/{id}/receive", s.adminReceiveGoods)
				r.With(requirePerm("procurement:pay", "procurement:update", "procurement")).Post("/purchase-orders/{id}/payments", s.adminRecordProcurementPayment)
			})

			r.Group(func(r chi.Router) {
				r.With(requirePerm("orders:read", "orders")).Get("/orders", s.adminListOrders)
				r.With(requirePerm("orders:read", "orders")).Get("/orders/{id}", s.adminGetOrder)
				r.With(requirePerm("orders:update", "orders")).Patch("/orders/{id}", s.adminUpdateOrder)
				r.With(requirePerm("orders:update", "orders")).Post("/orders/{id}/verify-payment", s.adminVerifyOrderPayment)
				r.With(requirePerm("orders:update", "orders")).Post("/orders/{id}/notify", s.adminNotifyCustomer)
			})

			r.Group(func(r chi.Router) {
				r.With(requirePerm("invoices:read", "invoices")).Get("/invoices", s.adminListInvoices)
				r.With(requirePerm("invoices:create", "invoices")).Post("/invoices", s.adminCreateInvoice)
				r.With(requirePerm("invoices:read", "invoices")).Get("/invoices/{id}", s.adminGetInvoice)
				r.With(requirePerm("invoices:update", "invoices")).Put("/invoices/{id}", s.adminUpdateInvoice)
				r.With(requirePerm("invoices:update", "invoices")).Patch("/invoices/{id}/status", s.adminSetInvoiceStatus)
				r.With(requirePerm("invoices:delete", "invoices")).Delete("/invoices/{id}", s.adminDeleteInvoice)
			})

			r.Group(func(r chi.Router) {
				r.With(requirePerm("settings:read", "settings")).Get("/settings", s.adminSettings)
				r.With(requirePerm("settings:update", "settings")).Put("/settings", s.adminUpdateSettings)
			})

			r.Group(func(r chi.Router) {
				r.With(requirePerm("blog:read", "blog")).Get("/blog", s.adminListPosts)
				r.With(requirePerm("blog:create", "blog")).Post("/blog", s.adminSavePost)
				r.With(requirePerm("blog:read", "blog")).Get("/blog/{id}", s.adminGetPost)
				r.With(requirePerm("blog:update", "blog")).Put("/blog/{id}", s.adminSavePost)
				r.With(requirePerm("blog:delete", "blog")).Delete("/blog/{id}", s.adminDeletePost)
			})

			r.Group(func(r chi.Router) {
				r.With(requirePerm("reviews:read", "reviews")).Get("/reviews", s.adminListReviews)
				r.With(requirePerm("reviews:update", "reviews")).Patch("/reviews/{id}", s.adminUpdateReview)
				r.With(requirePerm("reviews:delete", "reviews")).Delete("/reviews/{id}", s.adminDeleteReview)
			})

			r.With(requirePerm("subscribers:read", "subscribers")).Get("/subscribers", s.adminSubscribers)

			// Staff accounts and groups: admins only.
			r.Group(func(r chi.Router) {
				r.Use(requireRoleAdmin)
				r.Get("/staff", s.adminListStaff)
				r.Patch("/staff/{id}", s.adminUpdateStaff)
				r.Delete("/staff/{id}", s.adminDeleteStaff)
				r.Get("/groups", s.adminListGroups)
				r.Post("/groups", s.adminSaveGroup)
				r.Put("/groups/{id}", s.adminSaveGroup)
				r.Delete("/groups/{id}", s.adminDeleteGroup)
			})
		})
	})
	return r
}
