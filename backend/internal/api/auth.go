package api

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/mail"
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

// EnsureAdmin makes sure an approved admin exists. If none does, the
// account for ADMIN_EMAIL is created, or promoted if it already exists
// (e.g. it signed up as staff). This is also how you regain access if
// every admin is locked out.
func EnsureAdmin(ctx context.Context, st *store.Store, email, password string) {
	n, err := st.CountAdmins(ctx)
	if err != nil || n > 0 {
		return
	}
	if email == "" || password == "" {
		log.Println("warning: no approved admin exists; set ADMIN_EMAIL and ADMIN_PASSWORD to create one")
		return
	}
	if ok, err := st.PromoteToAdmin(ctx, email); err == nil && ok {
		log.Printf("promoted %s to admin (no approved admin existed)", email)
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("hash admin password: %v", err)
		return
	}
	if _, err := st.CreateAdmin(ctx, email, "Store Admin", string(hash), "admin", "approved"); err != nil {
		log.Printf("create admin: %v", err)
		return
	}
	log.Printf("created admin user %s", email)
}

// statusMessage explains why an account that isn't approved can't sign in.
func statusMessage(status string) string {
	if status == "disapproved" {
		return "Your access to the dashboard has been disapproved. Please wait for an administrator to approve your account again."
	}
	return "Your account is awaiting approval by an administrator. You'll be able to sign in once it's approved."
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
		// Load the account on every request, so disapproving someone or
		// changing their group takes effect immediately.
		u, err := s.store.AdminByID(r.Context(), claims.Subject)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "session expired, please sign in again")
			return
		}
		if u.Status != "approved" {
			writeError(w, http.StatusUnauthorized, statusMessage(u.Status))
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), adminKey, u)))
	})
}

// requirePerm allows admins, and staff whose group grants any of perms.
func requirePerm(perms ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			u := adminFrom(r.Context())
			for _, p := range perms {
				if u.Can(p) {
					next.ServeHTTP(w, r)
					return
				}
			}
			writeError(w, http.StatusForbidden, "you don't have access to this part of the dashboard; ask an administrator")
		})
	}
}

// requireRoleAdmin allows only admins (managing staff and groups).
func requireRoleAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if adminFrom(r.Context()).Role != "admin" {
			writeError(w, http.StatusForbidden, "only administrators can manage staff")
			return
		}
		next.ServeHTTP(w, r)
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
	// Only reveal the approval state once the password has been verified.
	if u.Status != "approved" {
		writeError(w, http.StatusForbidden, statusMessage(u.Status))
		return
	}
	s.store.TouchLogin(r.Context(), u.ID)
	token, err := s.issueToken(u)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": u})
}

// register lets a staff member request dashboard access. The account
// stays pending until an admin approves it.
func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decode(w, r, &in) {
		return
	}
	if !s.cache.Allow(r.Context(), "register:"+clientIP(r), 5, time.Hour) {
		writeError(w, http.StatusTooManyRequests, "too many sign-up attempts, try again later")
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	if a, err := mail.ParseAddress(in.Email); err != nil || a.Address != in.Email {
		writeError(w, http.StatusBadRequest, "enter a valid email address")
		return
	}
	switch {
	case in.Name == "" || len([]rune(in.Name)) > 80:
		writeError(w, http.StatusBadRequest, "enter your full name")
		return
	case len(in.Password) < 8:
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	case len(in.Password) > 72:
		writeError(w, http.StatusBadRequest, "password must be at most 72 characters")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		writeStoreError(w, err)
		return
	}
	u, err := s.store.CreateAdmin(r.Context(), in.Email, in.Name, string(hash), "staff", "pending")
	if errors.Is(err, store.ErrConflict) {
		writeError(w, http.StatusConflict, "an account with this email already exists; sign in instead")
		return
	}
	if err != nil {
		writeStoreError(w, err)
		return
	}
	go s.notifier.NotifyText(context.Background(), fmt.Sprintf("👤 %s (%s) requested staff access. Review: %s/admin/staff",
		u.Name, u.Email, s.cfg.FrontendURL))
	writeJSON(w, http.StatusCreated, map[string]any{"status": u.Status, "message": statusMessage(u.Status)})
}

type meResponse struct {
	models.AdminUser
	PendingStaff int `json:"pending_staff"`
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	u := adminFrom(r.Context())
	out := meResponse{AdminUser: u}
	if u.Role == "admin" {
		out.PendingStaff, _ = s.store.CountPendingStaff(r.Context())
	}
	writeJSON(w, http.StatusOK, out)
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
	if len(in.New) < 8 || len(in.New) > 72 {
		writeError(w, http.StatusBadRequest, "new password must be 8–72 characters")
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
