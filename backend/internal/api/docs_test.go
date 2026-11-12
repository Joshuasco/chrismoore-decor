package api

import (
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	"chrismoore-decor/backend/internal/cache"
	"chrismoore-decor/backend/internal/config"
	"chrismoore-decor/backend/internal/store"

	"github.com/go-chi/chi/v5"
	"go.yaml.in/yaml/v3"
)

func testServer(docs bool) *Server {
	return NewServer(config.Config{DocsEnabled: docs, AllowedOrigins: []string{"*"}}, store.New(nil), &cache.Cache{})
}

// Every route the API serves must be documented, and every documented
// operation must exist — so the Swagger UI never lies.
func TestOpenAPIMatchesRoutes(t *testing.T) {
	var spec struct {
		Paths map[string]map[string]any `yaml:"paths"`
	}
	if err := yaml.Unmarshal(openAPISpec, &spec); err != nil {
		t.Fatalf("openapi.yaml is not valid YAML: %v", err)
	}
	documented := map[string]bool{}
	for path, item := range spec.Paths {
		for method := range item {
			if method != "parameters" {
				documented[strings.ToUpper(method)+" "+path] = true
			}
		}
	}

	served := map[string]bool{}
	router, ok := testServer(false).Routes().(chi.Routes)
	if !ok {
		t.Fatal("Routes() is not a chi router")
	}
	err := chi.Walk(router, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		route = strings.TrimSuffix(strings.ReplaceAll(route, "/*/", "/"), "/")
		if route == "" {
			route = "/"
		}
		if route != "/docs" && route != "/openapi.yaml" {
			served[method+" "+route] = true
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}

	var missing, stale []string
	for r := range served {
		if !documented[r] {
			missing = append(missing, r)
		}
	}
	for r := range documented {
		if !served[r] {
			stale = append(stale, r)
		}
	}
	sort.Strings(missing)
	sort.Strings(stale)
	if len(missing) > 0 {
		t.Errorf("routes not documented in openapi.yaml:\n  %s", strings.Join(missing, "\n  "))
	}
	if len(stale) > 0 {
		t.Errorf("openapi.yaml documents routes that don't exist:\n  %s", strings.Join(stale, "\n  "))
	}
	if len(served) < 40 {
		t.Errorf("expected the full route table, walked only %d routes", len(served))
	}
}

func TestDocsEndpoints(t *testing.T) {
	on := testServer(true).Routes()
	for path, want := range map[string]string{"/docs": "swagger-ui-bundle.js", "/openapi.yaml": "openapi: 3.0.3"} {
		rec := httptest.NewRecorder()
		on.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), want) {
			t.Errorf("GET %s: status %d, body missing %q", path, rec.Code, want)
		}
	}
	off := testServer(false).Routes()
	for _, path := range []string{"/docs", "/openapi.yaml"} {
		rec := httptest.NewRecorder()
		off.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusNotFound {
			t.Errorf("GET %s with docs disabled: status %d, want 404", path, rec.Code)
		}
	}
}
