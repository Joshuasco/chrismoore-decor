package config

import (
	"log"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port        string
	Env         string
	DatabaseURL string
	RedisURL    string
	JWTSecret   string

	// Comma-separated list of origins allowed by CORS.
	AllowedOrigins []string
	// Public URL of the storefront, used to build payment callback URLs.
	FrontendURL string

	AdminEmail    string
	AdminPassword string

	PaystackSecretKey string

	FlutterwaveSecretKey  string
	FlutterwaveSecretHash string

	// Optional WhatsApp Cloud API credentials, used to ping the store
	// owner when a new order is placed.
	WhatsAppToken         string
	WhatsAppPhoneNumberID string
	WhatsAppNotifyTo      string

	SupabaseURL            string
	SupabaseServiceRoleKey string
	SupabaseBucket         string

	AutoMigrate bool
}

func Load() Config {
	c := Config{
		Port:                   env("PORT", "8080"),
		Env:                    env("APP_ENV", "development"),
		DatabaseURL:            env("DATABASE_URL", ""),
		RedisURL:               env("REDIS_URL", "redis://localhost:6379/0"),
		JWTSecret:              env("JWT_SECRET", ""),
		AllowedOrigins:         split(env("ALLOWED_ORIGINS", "http://localhost:3000")),
		FrontendURL:            strings.TrimRight(env("FRONTEND_URL", "http://localhost:3000"), "/"),
		AdminEmail:             env("ADMIN_EMAIL", ""),
		AdminPassword:          env("ADMIN_PASSWORD", ""),
		PaystackSecretKey:      env("PAYSTACK_SECRET_KEY", ""),
		FlutterwaveSecretKey:   env("FLUTTERWAVE_SECRET_KEY", ""),
		FlutterwaveSecretHash:  env("FLUTTERWAVE_SECRET_HASH", ""),
		WhatsAppToken:          env("WHATSAPP_TOKEN", ""),
		WhatsAppPhoneNumberID:  env("WHATSAPP_PHONE_NUMBER_ID", ""),
		WhatsAppNotifyTo:       env("WHATSAPP_NOTIFY_TO", ""),
		SupabaseURL:            strings.TrimRight(env("SUPABASE_URL", ""), "/"),
		SupabaseServiceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY", ""),
		SupabaseBucket:         env("SUPABASE_BUCKET", "product-images"),
		AutoMigrate:            boolEnv("AUTO_MIGRATE", true),
	}
	if c.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	if c.JWTSecret == "" {
		if c.Env == "production" {
			log.Fatal("JWT_SECRET is required in production")
		}
		c.JWTSecret = "dev-only-insecure-secret"
		log.Println("warning: JWT_SECRET not set, using an insecure development secret")
	}
	return c
}

func env(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}
	return def
}

func boolEnv(key string, def bool) bool {
	v, err := strconv.ParseBool(env(key, strconv.FormatBool(def)))
	if err != nil {
		return def
	}
	return v
}

func split(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
