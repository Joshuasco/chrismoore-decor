// Package cache wraps Redis for read-through JSON caching and simple rate
// limiting. Every method degrades gracefully: if Redis is unreachable the
// API keeps working, just without the cache.
package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

const versionKey = "cmd:catalog:version"

type Cache struct {
	rdb *redis.Client
}

func New(ctx context.Context, url string) *Cache {
	opt, err := redis.ParseURL(url)
	if err != nil {
		log.Printf("redis disabled: invalid REDIS_URL: %v", err)
		return &Cache{}
	}
	rdb := redis.NewClient(opt)
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("redis unavailable, continuing without cache: %v", err)
	}
	return &Cache{rdb: rdb}
}

func (c *Cache) Enabled() bool { return c != nil && c.rdb != nil }

func (c *Cache) Close() {
	if c.Enabled() {
		_ = c.rdb.Close()
	}
}

// catalogVersion namespaces catalogue keys so that a single INCR
// invalidates every cached product/category response at once.
func (c *Cache) catalogVersion(ctx context.Context) int64 {
	v, err := c.rdb.Get(ctx, versionKey).Int64()
	if err != nil {
		return 0
	}
	return v
}

func (c *Cache) CatalogKey(ctx context.Context, parts string) string {
	if !c.Enabled() {
		return ""
	}
	return fmt.Sprintf("cmd:catalog:%d:%s", c.catalogVersion(ctx), parts)
}

// InvalidateCatalog drops every cached catalogue response.
func (c *Cache) InvalidateCatalog(ctx context.Context) {
	if !c.Enabled() {
		return
	}
	if err := c.rdb.Incr(ctx, versionKey).Err(); err != nil {
		log.Printf("cache invalidate: %v", err)
	}
}

func (c *Cache) GetJSON(ctx context.Context, key string, dst any) bool {
	if !c.Enabled() || key == "" {
		return false
	}
	b, err := c.rdb.Get(ctx, key).Bytes()
	if err != nil {
		return false
	}
	return json.Unmarshal(b, dst) == nil
}

func (c *Cache) SetJSON(ctx context.Context, key string, v any, ttl time.Duration) {
	if !c.Enabled() || key == "" {
		return
	}
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	_ = c.rdb.Set(ctx, key, b, ttl).Err()
}

func (c *Cache) Delete(ctx context.Context, keys ...string) {
	if c.Enabled() {
		_ = c.rdb.Del(ctx, keys...).Err()
	}
}

// Allow implements a fixed-window rate limiter. It fails open when Redis is
// down so that a cache outage never blocks checkout.
func (c *Cache) Allow(ctx context.Context, bucket string, limit int, window time.Duration) bool {
	if !c.Enabled() {
		return true
	}
	key := "cmd:rl:" + bucket
	pipe := c.rdb.TxPipeline()
	incr := pipe.Incr(ctx, key)
	pipe.ExpireNX(ctx, key, window)
	if _, err := pipe.Exec(ctx); err != nil {
		return true
	}
	return incr.Val() <= int64(limit)
}
