// Package cache wraps Redis for read-through JSON caching and simple rate
// limiting. Every method degrades gracefully: if Redis is unreachable the
// API keeps working, just without the cache.
package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"sync/atomic"
	"time"

	"github.com/redis/go-redis/v9"
)

const versionKey = "cmd:catalog:version"

// outageBackoff is how long Redis is skipped after a connection failure,
// so an outage costs one fast failure per window instead of slowing every
// request.
const outageBackoff = 15 * time.Second

type Cache struct {
	rdb       *redis.Client
	downUntil atomic.Int64 // unix nanos; Redis is skipped until then
}

func New(ctx context.Context, url string) *Cache {
	opt, err := redis.ParseURL(url)
	if err != nil {
		log.Printf("redis disabled: invalid REDIS_URL: %v", err)
		return &Cache{}
	}
	// Fail fast: a cache is only useful if it's quicker than the database.
	opt.DialTimeout = time.Second
	opt.ReadTimeout = time.Second
	opt.WriteTimeout = time.Second
	opt.MaxRetries = -1 // no command retries
	opt.DialerRetries = 1
	c := &Cache{rdb: redis.NewClient(opt)}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	if err := c.rdb.Ping(ctx).Err(); err != nil {
		log.Printf("redis unavailable, continuing without cache (will retry): %v", err)
		c.markDown()
	}
	return c
}

// Enabled reports whether Redis is configured.
func (c *Cache) Enabled() bool { return c != nil && c.rdb != nil }

// Up reports whether Redis is configured and not in an outage backoff.
func (c *Cache) Up() bool { return c.Enabled() && time.Now().UnixNano() >= c.downUntil.Load() }

func (c *Cache) markDown() { c.downUntil.Store(time.Now().Add(outageBackoff).UnixNano()) }

// check records connection failures. Cache misses and Redis command errors
// don't count as an outage.
func (c *Cache) check(err error) {
	var rerr redis.Error
	if err == nil || errors.Is(err, redis.Nil) || errors.As(err, &rerr) || errors.Is(err, context.Canceled) {
		return
	}
	c.markDown()
}

func (c *Cache) Close() {
	if c.Enabled() {
		_ = c.rdb.Close()
	}
}

// catalogVersion namespaces catalogue keys so that a single INCR
// invalidates every cached product/category response at once.
func (c *Cache) catalogVersion(ctx context.Context) (int64, bool) {
	v, err := c.rdb.Get(ctx, versionKey).Int64()
	if errors.Is(err, redis.Nil) {
		return 0, true
	}
	c.check(err)
	return v, err == nil
}

// CatalogKey returns a versioned cache key, or "" (skip the cache) when
// Redis isn't available.
func (c *Cache) CatalogKey(ctx context.Context, parts string) string {
	if !c.Up() {
		return ""
	}
	v, ok := c.catalogVersion(ctx)
	if !ok {
		return ""
	}
	return fmt.Sprintf("cmd:catalog:%d:%s", v, parts)
}

// InvalidateCatalog drops every cached catalogue response.
func (c *Cache) InvalidateCatalog(ctx context.Context) {
	if !c.Enabled() {
		return
	}
	// Always try, even during a backoff: a missed invalidation would serve
	// stale data once Redis is back.
	if err := c.rdb.Incr(ctx, versionKey).Err(); err != nil {
		c.check(err)
		log.Printf("cache invalidate: %v", err)
	}
}

func (c *Cache) GetJSON(ctx context.Context, key string, dst any) bool {
	if !c.Up() || key == "" {
		return false
	}
	b, err := c.rdb.Get(ctx, key).Bytes()
	if err != nil {
		c.check(err)
		return false
	}
	return json.Unmarshal(b, dst) == nil
}

func (c *Cache) SetJSON(ctx context.Context, key string, v any, ttl time.Duration) {
	if !c.Up() || key == "" {
		return
	}
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	c.check(c.rdb.Set(ctx, key, b, ttl).Err())
}

func (c *Cache) Delete(ctx context.Context, keys ...string) {
	if c.Up() {
		c.check(c.rdb.Del(ctx, keys...).Err())
	}
}

// Allow implements a fixed-window rate limiter. It fails open when Redis is
// down so that a cache outage never blocks checkout.
func (c *Cache) Allow(ctx context.Context, bucket string, limit int, window time.Duration) bool {
	if !c.Up() {
		return true
	}
	key := "cmd:rl:" + bucket
	pipe := c.rdb.TxPipeline()
	incr := pipe.Incr(ctx, key)
	pipe.ExpireNX(ctx, key, window)
	if _, err := pipe.Exec(ctx); err != nil {
		c.check(err)
		return true
	}
	return incr.Val() <= int64(limit)
}
