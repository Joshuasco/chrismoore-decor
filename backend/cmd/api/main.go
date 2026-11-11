package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"chrismoore-decor/backend/internal/api"
	"chrismoore-decor/backend/internal/cache"
	"chrismoore-decor/backend/internal/config"
	"chrismoore-decor/backend/internal/database"
	"chrismoore-decor/backend/internal/store"

	"github.com/joho/godotenv"
)

func main() {
	seed := flag.Bool("seed", false, "load the demo catalogue if the products table is empty")
	migrateOnly := flag.Bool("migrate", false, "apply migrations and exit")
	flag.Parse()

	_ = godotenv.Load()
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	if cfg.AutoMigrate || *migrateOnly {
		if err := database.Migrate(ctx, pool); err != nil {
			log.Fatalf("migrate: %v", err)
		}
	}
	if *seed {
		if err := database.Seed(ctx, pool); err != nil {
			log.Fatalf("seed: %v", err)
		}
	}
	if *migrateOnly {
		return
	}

	rc := cache.New(ctx, cfg.RedisURL)
	defer rc.Close()

	st := store.New(pool)
	api.EnsureAdmin(ctx, st, cfg.AdminEmail, cfg.AdminPassword)

	// Release stock held by online orders that were never paid.
	go func() {
		t := time.NewTicker(15 * time.Minute)
		defer t.Stop()
		for {
			if n, err := st.ExpireStaleOrders(ctx, 3*time.Hour); err != nil {
				log.Printf("expire orders: %v", err)
			} else if n > 0 {
				rc.InvalidateCatalog(ctx)
				log.Printf("expired %d unpaid orders", n)
			}
			select {
			case <-ctx.Done():
				return
			case <-t.C:
			}
		}
	}()

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           api.NewServer(cfg, st, rc).Routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		log.Printf("Chris Moore Decor API listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server: %v", err)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
	log.Println("server stopped")
}
