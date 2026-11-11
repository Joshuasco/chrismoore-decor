// Package storage uploads product images to Supabase Storage.
package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

var ErrNotConfigured = errors.New("image uploads are not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)")

type Supabase struct {
	URL        string
	ServiceKey string
	Bucket     string
}

func (s Supabase) Configured() bool { return s.URL != "" && s.ServiceKey != "" && s.Bucket != "" }

// Upload stores the object at path in the (public) bucket and returns its
// public URL.
func (s Supabase) Upload(ctx context.Context, path, contentType string, body io.Reader) (string, error) {
	if !s.Configured() {
		return "", ErrNotConfigured
	}
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	endpoint := fmt.Sprintf("%s/storage/v1/object/%s/%s", s.URL, s.Bucket, path)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+s.ServiceKey)
	req.Header.Set("apikey", s.ServiceKey)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Cache-Control", "max-age=31536000")
	req.Header.Set("x-upsert", "true")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(res.Body, 500))
		return "", fmt.Errorf("supabase storage %d: %s", res.StatusCode, msg)
	}
	return fmt.Sprintf("%s/storage/v1/object/public/%s/%s", s.URL, s.Bucket, path), nil
}
