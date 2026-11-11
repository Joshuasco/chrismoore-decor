package database

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"sort"
	"time"

	"chrismoore-decor/backend/migrations"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	cfg.MaxConns = 10
	cfg.MaxConnIdleTime = 5 * time.Minute
	// Supabase's transaction pooler (port 6543) does not support prepared
	// statements, so use the simple protocol with cached descriptions off.
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return pool, nil
}

// Migrate applies every embedded *.sql file that has not been recorded in
// schema_migrations, in lexical order, each inside its own transaction.
func Migrate(ctx context.Context, db *pgxpool.Pool) error {
	if _, err := db.Exec(ctx, `create table if not exists schema_migrations (
		version text primary key, applied_at timestamptz not null default now())`); err != nil {
		return err
	}
	names, err := fs.Glob(migrations.Files, "*.sql")
	if err != nil {
		return err
	}
	sort.Strings(names)
	for _, name := range names {
		var exists bool
		if err := db.QueryRow(ctx, `select exists(select 1 from schema_migrations where version=$1)`, name).Scan(&exists); err != nil {
			return err
		}
		if exists {
			continue
		}
		sql, err := migrations.Files.ReadFile(name)
		if err != nil {
			return err
		}
		err = pgx.BeginFunc(ctx, db, func(tx pgx.Tx) error {
			if _, err := tx.Exec(ctx, string(sql)); err != nil {
				return err
			}
			_, err := tx.Exec(ctx, `insert into schema_migrations(version) values($1)`, name)
			return err
		})
		if err != nil {
			return fmt.Errorf("migration %s: %w", name, err)
		}
		log.Printf("applied migration %s", name)
	}
	return nil
}

// Seed loads the demo catalogue and blog posts, each only when its table is empty.
func Seed(ctx context.Context, db *pgxpool.Pool) error {
	sets := []struct{ table, sql, name string }{
		{"products", migrations.Seed, "demo catalogue"},
		{"blog_posts", migrations.BlogSeed, "demo blog posts"},
		// Reviews reference the seeded products by slug, so they run after them.
		{"product_reviews", migrations.ReviewSeed, "demo product reviews"},
	}
	for _, s := range sets {
		var n int
		if err := db.QueryRow(ctx, "select count(*) from "+s.table).Scan(&n); err != nil {
			return err
		}
		if n > 0 {
			log.Printf("seed skipped: %s already has rows", s.table)
			continue
		}
		if _, err := db.Exec(ctx, s.sql); err != nil {
			return fmt.Errorf("seed %s: %w", s.name, err)
		}
		log.Printf("seeded %s", s.name)
	}
	return nil
}
