package store

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"chrismoore-decor/backend/internal/models"
)

// ReviewSummary aggregates a product's approved reviews.
func (s *Store) ReviewSummary(ctx context.Context, productID string) (models.ReviewSummary, error) {
	sum := models.ReviewSummary{Breakdown: map[int]int{1: 0, 2: 0, 3: 0, 4: 0, 5: 0}}
	rows, err := s.db.Query(ctx, `select rating, count(*) from product_reviews
		where product_id = $1 and status = 'approved' group by rating`, productID)
	if err != nil {
		return sum, err
	}
	defer rows.Close()
	total := 0
	for rows.Next() {
		var stars, n int
		if err := rows.Scan(&stars, &n); err != nil {
			return sum, err
		}
		sum.Breakdown[stars] = n
		sum.Count += n
		total += stars * n
	}
	if sum.Count > 0 {
		// Same rounding as the products.rating column (1 decimal place).
		sum.Average = float64(int(float64(total)/float64(sum.Count)*10+0.5)) / 10
	}
	return sum, rows.Err()
}

// ListReviews returns approved reviews for the storefront.
func (s *Store) ListReviews(ctx context.Context, productID string, f models.ReviewFilter) (models.ReviewPage, error) {
	f.Page, f.Limit = clampPage(f.Page, f.Limit, 5, 50)
	args := []any{productID}
	where := "product_id = $1 and status = 'approved'"
	if f.Rating >= 1 && f.Rating <= 5 {
		args = append(args, f.Rating)
		where += fmt.Sprintf(" and rating = $%d", len(args))
	}
	order := map[string]string{"highest": "rating desc, created_at desc", "lowest": "rating asc, created_at desc"}[f.Sort]
	if order == "" {
		order = "created_at desc"
	}
	page := models.ReviewPage{Items: []models.Review{}, Page: f.Page, Limit: f.Limit}
	if err := s.db.QueryRow(ctx, "select count(*) from product_reviews where "+where, args...).Scan(&page.Total); err != nil {
		return page, err
	}
	args = append(args, f.Limit, (f.Page-1)*f.Limit)
	rows, err := s.db.Query(ctx, fmt.Sprintf(`select id, product_id, name, rating, title, body, verified, created_at
		from product_reviews where %s order by %s, id limit $%d offset $%d`, where, order, len(args)-1, len(args)), args...)
	if err != nil {
		return page, err
	}
	defer rows.Close()
	for rows.Next() {
		var r models.Review
		if err := rows.Scan(&r.ID, &r.ProductID, &r.Name, &r.Rating, &r.Title, &r.Body, &r.Verified, &r.CreatedAt); err != nil {
			return page, err
		}
		page.Items = append(page.Items, r)
	}
	if err := rows.Err(); err != nil {
		return page, err
	}
	page.Summary, err = s.ReviewSummary(ctx, productID)
	return page, err
}

// NormalizeReview validates and tidies a customer submission.
func NormalizeReview(in *models.ReviewInput) error {
	in.Name = strings.TrimSpace(in.Name)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.Title = strings.TrimSpace(in.Title)
	in.Body = strings.TrimSpace(in.Body)
	switch {
	case len([]rune(in.Name)) < 2 || len([]rune(in.Name)) > 60:
		return fmt.Errorf("%w: please enter your name", ErrInvalid)
	case in.Rating < 1 || in.Rating > 5:
		return fmt.Errorf("%w: please choose a star rating", ErrInvalid)
	case len([]rune(in.Title)) > 120:
		return fmt.Errorf("%w: the title is too long (120 characters max)", ErrInvalid)
	case len([]rune(in.Body)) < 10:
		return fmt.Errorf("%w: please write at least a sentence about the product", ErrInvalid)
	case len([]rune(in.Body)) > 2000:
		return fmt.Errorf("%w: reviews can be up to 2,000 characters", ErrInvalid)
	}
	return nil
}

// CreateReview stores a customer review as pending. It is marked verified when
// the email has a paid or delivered order containing this product.
func (s *Store) CreateReview(ctx context.Context, productID string, in models.ReviewInput) error {
	if err := NormalizeReview(&in); err != nil {
		return err
	}
	_, err := s.db.Exec(ctx, `insert into product_reviews (product_id, name, email, rating, title, body, status, verified)
		values ($1, $2, $3, $4, $5, $6, 'pending', exists(
			select 1 from orders o join order_items i on i.order_id = o.id
			where i.product_id = $1 and lower(o.email) = $3
			  and (o.payment_status = 'paid' or o.status = 'delivered')))`,
		productID, in.Name, in.Email, in.Rating, in.Title, in.Body)
	return mapErr(err)
}

// ---------- Admin ----------

func (s *Store) AdminListReviews(ctx context.Context, f models.ReviewFilter) (models.ReviewPage, error) {
	f.Page, f.Limit = clampPage(f.Page, f.Limit, 20, 100)
	var where []string
	var args []any
	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}
	if slices.Contains([]string{"pending", "approved", "rejected"}, f.Status) {
		where = append(where, "r.status = "+arg(f.Status))
	}
	if f.Rating >= 1 && f.Rating <= 5 {
		where = append(where, "r.rating = "+arg(f.Rating))
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		ph := arg("%" + q + "%")
		where = append(where, fmt.Sprintf("(r.name ilike %[1]s or r.email ilike %[1]s or r.title ilike %[1]s or r.body ilike %[1]s or p.name ilike %[1]s)", ph))
	}
	clause := ""
	if len(where) > 0 {
		clause = " where " + strings.Join(where, " and ")
	}
	from := " from product_reviews r join products p on p.id = r.product_id" + clause
	page := models.ReviewPage{Items: []models.Review{}, Page: f.Page, Limit: f.Limit}
	if err := s.db.QueryRow(ctx, "select count(*)"+from, args...).Scan(&page.Total); err != nil {
		return page, err
	}
	lp, op := arg(f.Limit), arg((f.Page-1)*f.Limit)
	rows, err := s.db.Query(ctx, `select r.id, r.product_id, r.name, r.email, r.rating, r.title, r.body, r.status, r.verified,
			r.created_at, p.name, p.slug, coalesce(p.images[1], '')`+from+
		" order by (r.status = 'pending') desc, r.created_at desc, r.id limit "+lp+" offset "+op, args...)
	if err != nil {
		return page, err
	}
	defer rows.Close()
	for rows.Next() {
		var r models.Review
		if err := rows.Scan(&r.ID, &r.ProductID, &r.Name, &r.Email, &r.Rating, &r.Title, &r.Body, &r.Status, &r.Verified,
			&r.CreatedAt, &r.ProductName, &r.ProductSlug, &r.ProductImage); err != nil {
			return page, err
		}
		page.Items = append(page.Items, r)
	}
	return page, rows.Err()
}

// SetReviewStatus approves or rejects a review; the trigger keeps the product's rating in sync.
func (s *Store) SetReviewStatus(ctx context.Context, id, status string) error {
	if !slices.Contains([]string{"pending", "approved", "rejected"}, status) {
		return ErrInvalid
	}
	tag, err := s.db.Exec(ctx, `update product_reviews set status = $2, updated_at = now() where id = $1`, id, status)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) DeleteReview(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `delete from product_reviews where id = $1`, id)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
