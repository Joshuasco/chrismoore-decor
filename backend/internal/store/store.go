// Package store holds all SQL access for the API.
package store

import (
	"errors"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound     = errors.New("not found")
	ErrConflict     = errors.New("already exists")
	ErrInsufficient = errors.New("insufficient stock")
	ErrInvalid      = errors.New("invalid input")
)

type Store struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Store { return &Store{db: db} }

func (s *Store) DB() *pgxpool.Pool { return s.db }

func mapErr(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			return ErrConflict
		case "23503", "23514", "22P02":
			return ErrInvalid
		}
	}
	return err
}

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

func Slugify(s string) string {
	s = nonSlug.ReplaceAllString(strings.ToLower(strings.TrimSpace(s)), "-")
	return strings.Trim(s, "-")
}

func clampPage(page, limit, def, max int) (int, int) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = def
	}
	if limit > max {
		limit = max
	}
	return page, limit
}

// validImageURL accepts empty or absolute https:// URLs. The storefront's
// image optimiser only loads remote images over HTTPS, so anything else
// would break the page that shows it.
func validImageURL(u string) bool {
	return u == "" || strings.HasPrefix(u, "https://")
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	out := s[:0:0]
	for _, v := range s {
		if v = strings.TrimSpace(v); v != "" {
			out = append(out, v)
		}
	}
	return out
}
