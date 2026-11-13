package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"chrismoore-decor/backend/internal/models"
)

func withUser(r *http.Request, u models.AdminUser) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), adminKey, u))
}

func TestRequirePerm(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	h := requirePerm("products", "inventory")(ok)
	cases := []struct {
		name string
		user models.AdminUser
		want int
	}{
		{"admin has everything", models.AdminUser{Role: "admin"}, 200},
		{"staff with one of the services", models.AdminUser{Role: "staff", Permissions: []string{"inventory"}}, 200},
		{"staff without the service", models.AdminUser{Role: "staff", Permissions: []string{"orders", "blog"}}, 403},
		{"staff with no group", models.AdminUser{Role: "staff"}, 403},
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, withUser(httptest.NewRequest("GET", "/", nil), c.user))
		if rec.Code != c.want {
			t.Errorf("%s: status %d, want %d", c.name, rec.Code, c.want)
		}
	}
}

func TestRequireRoleAdmin(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	h := requireRoleAdmin(ok)
	// Even a staff member granted every service can't manage staff.
	staff := models.AdminUser{Role: "staff", Permissions: models.PermissionKeys()}
	for _, c := range []struct {
		user models.AdminUser
		want int
	}{{models.AdminUser{Role: "admin"}, 200}, {staff, 403}} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, withUser(httptest.NewRequest("GET", "/", nil), c.user))
		if rec.Code != c.want {
			t.Errorf("role %s: status %d, want %d", c.user.Role, rec.Code, c.want)
		}
	}
}

// Every admin route except login/register must require a token.
func TestAdminRoutesNeedAuth(t *testing.T) {
	h := testServer(false).Routes()
	for _, path := range []string{"/api/admin/me", "/api/admin/staff", "/api/admin/groups", "/api/admin/invoices", "/api/admin/orders"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("GET %s without a token: status %d, want 401", path, rec.Code)
		}
	}
}

func TestRegisterValidation(t *testing.T) {
	h := testServer(false).Routes()
	for _, body := range []string{
		`{"name":"Ada","email":"not-an-email","password":"longenough"}`,
		`{"name":"Ada","email":"Ada <ada@example.com>","password":"longenough"}`,
		`{"name":"","email":"ada@example.com","password":"longenough"}`,
		`{"name":"Ada","email":"ada@example.com","password":"short"}`,
		`{"name":"Ada","email":"ada@example.com","password":"x","role":"admin"}`, // can't self-assign a role
	} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/admin/register", strings.NewReader(body)))
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400", body, rec.Code)
		}
	}
}

func TestStatusMessage(t *testing.T) {
	if !strings.Contains(statusMessage("pending"), "awaiting approval") || !strings.Contains(statusMessage("disapproved"), "disapproved") {
		t.Error("status messages should explain pending and disapproved accounts")
	}
}

func TestMailtoEscaping(t *testing.T) {
	if got := pathEscape("Invoice INV-00001 & co\n"); got != "Invoice%20INV-00001%20%26%20co%0A" {
		t.Errorf("pathEscape = %q", got)
	}
}
