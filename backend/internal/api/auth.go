package api

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"chrismoore-decor/backend/internal/models"
	"chrismoore-decor/backend/internal/store"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type ctxKey int

const adminKey ctxKey = 1

func adminFrom(ctx context.Context) models.AdminUser {
	u, _ := ctx.Value(adminKey).(models.AdminUser)
	return u
}

// EnsureAdmin creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD
// when the admin_users table is empty.
func EnsureAdmin(ctx context.Context, st *store.Store, email, password string) {
	n, err := st.CountAdmins(ctx)
	if err != nil || n > 0 {
		return
	}
	if email == "" || password == "" {
		log.Println("warning: no admin users exist; set ADMIN_EMAIL and ADMIN_PASSWORD to create one")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("hash admin password: %v", err)
		return
	}
	if err := st.CreateAdmin(ctx, email, "Store Admin", string(hash), "admin"); err != nil {
		log.Printf("create admin: %v", err)
		return
	}
	log.Printf("created admin user %s", email)
}

func (s *Server) issueToken(u models.AdminUser) (string, error) {
	claims := jwt.RegisteredClaims{
		Subject:   u.ID,
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(12 * time.Hour)),
		Issuer:    "chrismoore-decor",
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(s.cfg.JWTSecret))
}

func (s *Server) requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if raw == "" {
			writeError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		var claims jwt.RegisteredClaims
		_, err := jwt.ParseWithClaims(raw, &claims, func(t *jwt.Token) (any, error) {
			return []byte(s.cfg.JWTSecret), nil
		}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer("chrismoore-decor"))
		if err != nil {
			writeError(w, http.StatusUnauthorized, "session expired, please sign in again")
			return
		}
		u, err := s.store.AdminByID(r.Context(), claims.Subject)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "session expired, please sign in again")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), adminKey, u)))
	})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decode(w, r, &in) {
		return
	}
	if !s.cache.Allow(r.Context(), "login:"+clientIP(r), 10, 15*time.Minute) {
		writeError(w, http.StatusTooManyRequests, "too many sign-in attempts, try again in a few minutes")
		return
	}
	u, err := s.store.AdminByEmail(r.Context(), in.Email)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(in.Password)) != nil {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	token, err := s.issueToken(u)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": u})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, adminFrom(r.Context()))
}

func (s *Server) changePassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Current string `json:"current_password"`
		New     string `json:"new_password"`
	}
	if !decode(w, r, &in) {
		return
	}
	u := adminFrom(r.Context())
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(in.Current)) != nil {
		writeError(w, http.StatusBadRequest, "current password is incorrect")
		return
	}
	if len(in.New) < 8 {
		writeError(w, http.StatusBadRequest, "new password must be at least 8 characters")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.New), bcrypt.DefaultCost)
	if err == nil {
		err = s.store.UpdateAdminPassword(r.Context(), u.ID, string(hash))
	}
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
