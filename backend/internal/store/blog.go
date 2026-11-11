package store

import (
	"context"
	"fmt"
	"math"
	"slices"
	"strings"
	"time"

	"chrismoore-decor/backend/internal/models"

	"github.com/jackc/pgx/v5"
)

// A post is live when it is published and its publish time has passed.
const livePost = `(b.status = 'published' and b.published_at <= now())`

const blogColumns = `b.id, b.title, b.slug, b.excerpt, b.cover_image, b.category, b.tags, b.author_name, b.status,
	b.is_featured, b.published_at, b.reading_minutes, b.product_category, b.seo_title, b.seo_description,
	b.created_at, b.updated_at`

func scanPost(row pgx.Row, withContent bool) (models.BlogPost, error) {
	var p models.BlogPost
	dest := []any{&p.ID, &p.Title, &p.Slug, &p.Excerpt, &p.CoverImage, &p.Category, &p.Tags, &p.AuthorName, &p.Status,
		&p.IsFeatured, &p.PublishedAt, &p.ReadingMinutes, &p.ProductCategory, &p.SEOTitle, &p.SEODescription,
		&p.CreatedAt, &p.UpdatedAt}
	if withContent {
		dest = append(dest, &p.Content)
	}
	err := row.Scan(dest...)
	p.Tags = nonNil(p.Tags)
	return p, err
}

// ReadingMinutes estimates reading time at ~200 words per minute.
func ReadingMinutes(content string) int {
	return max(1, int(math.Ceil(float64(len(strings.Fields(content)))/200)))
}

func (s *Store) ListPosts(ctx context.Context, f models.BlogFilter) (models.BlogPage, error) {
	f.Page, f.Limit = clampPage(f.Page, f.Limit, 9, 50)
	var where []string
	var args []any
	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}
	if !f.IncludeUnpublished {
		where = append(where, livePost)
	}
	switch f.Status {
	case "draft":
		where = append(where, "b.status = 'draft'")
	case "published":
		where = append(where, livePost)
	case "scheduled":
		where = append(where, "b.status = 'published' and b.published_at > now()")
	}
	if f.Category != "" {
		where = append(where, "lower(b.category) = lower("+arg(f.Category)+")")
	}
	if f.Tag != "" {
		where = append(where, arg(strings.ToLower(f.Tag))+" = any(b.tags)")
	}
	if f.Featured {
		where = append(where, "b.is_featured")
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		ph := arg("%" + q + "%")
		where = append(where, fmt.Sprintf("(b.title ilike %[1]s or b.excerpt ilike %[1]s or b.content ilike %[1]s or b.category ilike %[1]s)", ph))
	}
	clause := ""
	if len(where) > 0 {
		clause = " where " + strings.Join(where, " and ")
	}
	var total int
	if err := s.db.QueryRow(ctx, "select count(*) from blog_posts b"+clause, args...).Scan(&total); err != nil {
		return models.BlogPage{}, err
	}
	order := "coalesce(b.published_at, b.created_at) desc"
	if f.IncludeUnpublished {
		order = "b.updated_at desc"
	}
	lp, op := arg(f.Limit), arg((f.Page-1)*f.Limit)
	rows, err := s.db.Query(ctx, "select "+blogColumns+" from blog_posts b"+clause+
		" order by "+order+", b.id limit "+lp+" offset "+op, args...)
	if err != nil {
		return models.BlogPage{}, err
	}
	defer rows.Close()
	items := []models.BlogPost{}
	for rows.Next() {
		p, err := scanPost(rows, false)
		if err != nil {
			return models.BlogPage{}, err
		}
		items = append(items, p)
	}
	return models.BlogPage{Items: items, Total: total, Page: f.Page, Limit: f.Limit}, rows.Err()
}

func (s *Store) BlogCategories(ctx context.Context) ([]models.BlogCategory, error) {
	rows, err := s.db.Query(ctx, `select b.category, count(*) from blog_posts b where `+livePost+`
		group by b.category order by count(*) desc, b.category`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.BlogCategory{}
	for rows.Next() {
		var c models.BlogCategory
		if err := rows.Scan(&c.Name, &c.Count); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// GetLivePost returns a published post by slug (public).
func (s *Store) GetLivePost(ctx context.Context, slug string) (models.BlogPost, error) {
	p, err := scanPost(s.db.QueryRow(ctx, `select `+blogColumns+`, b.content from blog_posts b
		where b.slug=$1 and `+livePost, slug), true)
	return p, mapErr(err)
}

func (s *Store) GetPost(ctx context.Context, id string) (models.BlogPost, error) {
	p, err := scanPost(s.db.QueryRow(ctx, `select `+blogColumns+`, b.content from blog_posts b where b.id=$1`, id), true)
	return p, mapErr(err)
}

// RelatedPosts prefers the same category, then shared tags, then recency.
func (s *Store) RelatedPosts(ctx context.Context, p models.BlogPost, limit int) ([]models.BlogPost, error) {
	rows, err := s.db.Query(ctx, `select `+blogColumns+` from blog_posts b
		where `+livePost+` and b.id <> $1
		order by (lower(b.category) = lower($2)) desc, cardinality(array(select unnest(b.tags) intersect select unnest($3::text[]))) desc,
		         b.published_at desc
		limit $4`, p.ID, p.Category, p.Tags, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.BlogPost{}
	for rows.Next() {
		rp, err := scanPost(rows, false)
		if err != nil {
			return nil, err
		}
		out = append(out, rp)
	}
	return out, rows.Err()
}

func normalizePost(in *models.BlogPostInput) error {
	in.Title = strings.TrimSpace(in.Title)
	if in.Title == "" {
		return fmt.Errorf("%w: title is required", ErrInvalid)
	}
	if in.Slug = Slugify(in.Slug); in.Slug == "" {
		in.Slug = Slugify(in.Title)
	}
	if in.Slug == "categories" { // reserved by GET /api/blog/categories
		in.Slug = "categories-post"
	}
	if !slices.Contains([]string{"draft", "published"}, in.Status) {
		in.Status = "draft"
	}
	in.CoverImage = strings.TrimSpace(in.CoverImage)
	if !validImageURL(in.CoverImage) {
		return fmt.Errorf("%w: cover image URL must start with https://", ErrInvalid)
	}
	if in.Status == "published" && strings.TrimSpace(in.Content) == "" {
		return fmt.Errorf("%w: add some content before publishing", ErrInvalid)
	}
	// Publishing without a date means "now"; a future date schedules the post.
	if in.Status == "published" && in.PublishedAt == nil {
		now := time.Now()
		in.PublishedAt = &now
	}
	if in.Category = strings.TrimSpace(in.Category); in.Category == "" {
		in.Category = "Inspiration"
	}
	if strings.TrimSpace(in.AuthorName) == "" {
		in.AuthorName = "Chris Moore Interior Decor"
	}
	tags := []string{}
	for _, t := range in.Tags {
		if t = strings.ToLower(strings.TrimSpace(t)); t != "" && !slices.Contains(tags, t) {
			tags = append(tags, t)
		}
	}
	in.Tags = tags
	return nil
}

func (s *Store) CreatePost(ctx context.Context, in models.BlogPostInput) (models.BlogPost, error) {
	if err := normalizePost(&in); err != nil {
		return models.BlogPost{}, err
	}
	var id string
	err := s.db.QueryRow(ctx, `insert into blog_posts (title, slug, excerpt, content, cover_image, category, tags,
			author_name, status, is_featured, published_at, reading_minutes, product_category, seo_title, seo_description)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`,
		in.Title, in.Slug, in.Excerpt, in.Content, in.CoverImage, in.Category, in.Tags, in.AuthorName, in.Status,
		in.IsFeatured, in.PublishedAt, ReadingMinutes(in.Content), in.ProductCategory, in.SEOTitle, in.SEODescription).Scan(&id)
	if err != nil {
		return models.BlogPost{}, mapErr(err)
	}
	return s.GetPost(ctx, id)
}

func (s *Store) UpdatePost(ctx context.Context, id string, in models.BlogPostInput) (models.BlogPost, error) {
	if err := normalizePost(&in); err != nil {
		return models.BlogPost{}, err
	}
	tag, err := s.db.Exec(ctx, `update blog_posts set title=$2, slug=$3, excerpt=$4, content=$5, cover_image=$6,
			category=$7, tags=$8, author_name=$9, status=$10, is_featured=$11, published_at=$12, reading_minutes=$13,
			product_category=$14, seo_title=$15, seo_description=$16, updated_at=now()
		where id=$1`,
		id, in.Title, in.Slug, in.Excerpt, in.Content, in.CoverImage, in.Category, in.Tags, in.AuthorName, in.Status,
		in.IsFeatured, in.PublishedAt, ReadingMinutes(in.Content), in.ProductCategory, in.SEOTitle, in.SEODescription)
	if err != nil {
		return models.BlogPost{}, mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return models.BlogPost{}, ErrNotFound
	}
	return s.GetPost(ctx, id)
}

func (s *Store) DeletePost(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `delete from blog_posts where id=$1`, id)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
