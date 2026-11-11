// Package migrations embeds the SQL schema and the demo seed data.
package migrations

import "embed"

//go:embed *.sql
var Files embed.FS

//go:embed seed/seed.sql
var Seed string

//go:embed seed/blog.sql
var BlogSeed string

//go:embed seed/reviews.sql
var ReviewSeed string
