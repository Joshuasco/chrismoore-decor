package cache

import (
	"context"
	"testing"
	"time"
)

// With Redis unreachable, the cache must stay out of the way: no slow
// retries on every request, and rate limits fail open.
func TestUnreachableRedisFailsFast(t *testing.T) {
	c := New(context.Background(), "redis://127.0.0.1:1/0")
	if !c.Enabled() || c.Up() {
		t.Fatalf("configured but unreachable Redis should be enabled and down: enabled=%v up=%v", c.Enabled(), c.Up())
	}
	start := time.Now()
	for range 20 {
		if key := c.CatalogKey(context.Background(), "settings"); key != "" {
			t.Fatalf("expected no cache key during an outage, got %q", key)
		}
		var v map[string]string
		if c.GetJSON(context.Background(), "k", &v) {
			t.Fatal("expected a miss during an outage")
		}
		if !c.Allow(context.Background(), "x", 1, time.Minute) {
			t.Fatal("rate limiting must fail open during an outage")
		}
	}
	if d := time.Since(start); d > 200*time.Millisecond {
		t.Fatalf("calls during an outage took %v; they should skip Redis", d)
	}
}

func TestNilCacheIsSafe(t *testing.T) {
	c := &Cache{}
	if c.Enabled() || c.Up() || c.CatalogKey(context.Background(), "x") != "" || !c.Allow(context.Background(), "x", 0, time.Second) {
		t.Fatal("an unconfigured cache should be a no-op that allows everything")
	}
	c.InvalidateCatalog(context.Background())
}
