package store

import (
	"errors"
	"strings"
	"testing"

	"chrismoore-decor/backend/internal/models"
)

func TestSlugify(t *testing.T) {
	cases := map[string]string{"Sahara Linen Blend Curtains": "sahara-linen-blend-curtains", "  Rugs & Mats!! ": "rugs-mats", "Bed--Sheets": "bed-sheets"}
	for in, want := range cases {
		if got := Slugify(in); got != want {
			t.Errorf("Slugify(%q)=%q want %q", in, got, want)
		}
	}
}

func TestNewReference(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 1000; i++ {
		r := NewReference("CM-", 8)
		if len(r) != 11 || !strings.HasPrefix(r, "CM-") || strings.ContainsAny(r[3:], "01IO") {
			t.Fatalf("bad reference %q", r)
		}
		if seen[r] {
			t.Fatalf("duplicate reference %q", r)
		}
		seen[r] = true
	}
}

func TestStockErrorUnwraps(t *testing.T) {
	err := error(&StockError{Product: "Rug", Available: 2})
	if !errors.Is(err, ErrInsufficient) || err.Error() != "only 2 of Rug left in stock" {
		t.Fatalf("unexpected: %v", err)
	}
}

func TestReadingMinutes(t *testing.T) {
	if ReadingMinutes("") != 1 || ReadingMinutes(strings.Repeat("word ", 450)) != 3 {
		t.Fatal("unexpected reading time")
	}
}

func TestNormalizePost(t *testing.T) {
	in := models.BlogPostInput{Title: "  Curtain Care 101 ", Status: "published", Content: "Hello", Tags: []string{"Curtains", " curtains ", "", "Care"}}
	if err := normalizePost(&in); err != nil {
		t.Fatal(err)
	}
	if in.Slug != "curtain-care-101" || in.PublishedAt == nil || in.Category != "Inspiration" || len(in.Tags) != 2 {
		t.Fatalf("unexpected: %+v", in)
	}
	empty := models.BlogPostInput{Title: "x", Status: "published"}
	if normalizePost(&empty) == nil {
		t.Fatal("publishing without content should fail")
	}
	bad := models.BlogPostInput{Title: "x", Status: "weird"}
	if normalizePost(&bad) != nil || bad.Status != "draft" {
		t.Fatal("unknown status should become draft")
	}
}

func TestImageURLValidation(t *testing.T) {
	for u, ok := range map[string]bool{"": true, "https://x.supabase.co/a.jpg": true, "http://x.com/a.jpg": false, "javascript:alert(1)": false, "/local.jpg": false} {
		if validImageURL(u) != ok {
			t.Errorf("validImageURL(%q) != %v", u, ok)
		}
	}
	in := models.ProductInput{Name: "Rug", SKU: "R1", Images: []string{"http://insecure.example/a.jpg"}}
	if err := normalizeProduct(&in); err == nil || !strings.Contains(err.Error(), "https://") {
		t.Fatalf("expected https error, got %v", err)
	}
	post := models.BlogPostInput{Title: "x", CoverImage: "http://insecure.example/a.jpg"}
	if normalizePost(&post) == nil {
		t.Fatal("expected cover image error")
	}
}

func TestNormalizeReview(t *testing.T) {
	ok := models.ReviewInput{Name: " Ada ", Email: " ADA@x.com ", Rating: 5, Body: "  Lovely curtains, great quality.  "}
	if err := NormalizeReview(&ok); err != nil || ok.Name != "Ada" || ok.Email != "ada@x.com" || ok.Body != "Lovely curtains, great quality." {
		t.Fatalf("unexpected: %v %+v", err, ok)
	}
	bad := []models.ReviewInput{
		{Name: "A", Rating: 5, Body: "Long enough body"},
		{Name: "Ada", Rating: 0, Body: "Long enough body"},
		{Name: "Ada", Rating: 6, Body: "Long enough body"},
		{Name: "Ada", Rating: 4, Body: "short"},
		{Name: "Ada", Rating: 4, Body: strings.Repeat("x", 2001)},
		{Name: "Ada", Rating: 4, Body: "Long enough body", Title: strings.Repeat("t", 121)},
	}
	for i, in := range bad {
		if NormalizeReview(&in) == nil {
			t.Errorf("case %d should fail", i)
		}
	}
}
