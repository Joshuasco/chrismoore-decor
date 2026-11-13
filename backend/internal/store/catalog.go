package store

import (
	"context"
	"fmt"
	"strings"

	"chrismoore-decor/backend/internal/models"

	"github.com/jackc/pgx/v5"
)

const productColumns = `p.id, p.category_id, coalesce(c.name,''), coalesce(c.slug,''), p.name, p.slug, p.sku,
	p.short_description, p.description, p.price, p.compare_at_price, p.stock, p.low_stock_threshold,
	p.images, p.colors, p.sizes, p.material, p.badge, p.is_featured, p.is_active, p.rating::float8,
	p.review_count, p.created_at, p.updated_at`

func scanProduct(row pgx.Row) (models.Product, error) {
	var p models.Product
	err := row.Scan(&p.ID, &p.CategoryID, &p.CategoryName, &p.CategorySlug, &p.Name, &p.Slug, &p.SKU,
		&p.ShortDescription, &p.Description, &p.Price, &p.CompareAtPrice, &p.Stock, &p.LowStockThreshold,
		&p.Images, &p.Colors, &p.Sizes, &p.Material, &p.Badge, &p.IsFeatured, &p.IsActive, &p.Rating,
		&p.ReviewCount, &p.CreatedAt, &p.UpdatedAt)
	p.Images, p.Colors, p.Sizes = nonNil(p.Images), nonNil(p.Colors), nonNil(p.Sizes)
	return p, err
}

// ---------- Categories ----------

func (s *Store) ListCategories(ctx context.Context) ([]models.Category, error) {
	rows, err := s.db.Query(ctx, `
		select c.id, c.name, c.slug, c.description, c.image_url, c.sort_order, c.created_at,
		       count(p.id) filter (where p.is_active)
		from categories c left join products p on p.category_id = c.id
		group by c.id order by c.sort_order, c.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Category{}
	for rows.Next() {
		var c models.Category
		if err := rows.Scan(&c.ID, &c.Name, &c.Slug, &c.Description, &c.ImageURL, &c.SortOrder, &c.CreatedAt, &c.ProductCount); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) CreateCategory(ctx context.Context, in models.CategoryInput) (models.Category, error) {
	if !validImageURL(in.ImageURL) {
		return models.Category{}, fmt.Errorf("%w: image URL must start with https://", ErrInvalid)
	}
	if in.Slug == "" {
		in.Slug = Slugify(in.Name)
	}
	var c models.Category
	err := s.db.QueryRow(ctx, `
		insert into categories (name, slug, description, image_url, sort_order) values ($1,$2,$3,$4,$5)
		returning id, name, slug, description, image_url, sort_order, created_at`,
		in.Name, in.Slug, in.Description, in.ImageURL, in.SortOrder).
		Scan(&c.ID, &c.Name, &c.Slug, &c.Description, &c.ImageURL, &c.SortOrder, &c.CreatedAt)
	return c, mapErr(err)
}

func (s *Store) UpdateCategory(ctx context.Context, id string, in models.CategoryInput) (models.Category, error) {
	if !validImageURL(in.ImageURL) {
		return models.Category{}, fmt.Errorf("%w: image URL must start with https://", ErrInvalid)
	}
	if in.Slug == "" {
		in.Slug = Slugify(in.Name)
	}
	var c models.Category
	err := s.db.QueryRow(ctx, `
		update categories set name=$2, slug=$3, description=$4, image_url=$5, sort_order=$6, updated_at=now()
		where id=$1 returning id, name, slug, description, image_url, sort_order, created_at`,
		id, in.Name, in.Slug, in.Description, in.ImageURL, in.SortOrder).
		Scan(&c.ID, &c.Name, &c.Slug, &c.Description, &c.ImageURL, &c.SortOrder, &c.CreatedAt)
	return c, mapErr(err)
}

func (s *Store) DeleteCategory(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `delete from categories where id=$1`, id)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ---------- Products ----------

func (s *Store) ListProducts(ctx context.Context, f models.ProductFilter) (models.ProductPage, error) {
	f.Page, f.Limit = clampPage(f.Page, f.Limit, 12, 100)

	var where []string
	var args []any
	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}
	if !f.IncludeInactive {
		where = append(where, "p.is_active")
	}
	if f.Category != "" {
		where = append(where, "c.slug = "+arg(f.Category))
	}
	if f.Featured {
		where = append(where, "p.is_featured")
	}
	if f.MinPrice > 0 {
		where = append(where, "p.price >= "+arg(f.MinPrice))
	}
	if f.MaxPrice > 0 {
		where = append(where, "p.price <= "+arg(f.MaxPrice))
	}
	if f.LowStockOnly {
		where = append(where, "p.stock <= p.low_stock_threshold")
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		ph := arg("%" + q + "%")
		where = append(where, fmt.Sprintf("(p.name ilike %[1]s or p.sku ilike %[1]s or p.description ilike %[1]s or c.name ilike %[1]s)", ph))
	}
	clause := ""
	if len(where) > 0 {
		clause = "where " + strings.Join(where, " and ")
	}

	order := map[string]string{
		"price_asc":  "p.price asc",
		"price_desc": "p.price desc",
		"popular":    "p.review_count desc, p.rating desc",
		"rating":     "p.rating desc, p.review_count desc",
		"name":       "p.name asc",
		"stock":      "p.stock asc",
	}[f.Sort]
	if order == "" {
		order = "p.created_at desc"
	}

	from := `from products p left join categories c on c.id = p.category_id ` + clause
	var total int
	if err := s.db.QueryRow(ctx, "select count(*) "+from, args...).Scan(&total); err != nil {
		return models.ProductPage{}, err
	}
	limitPh, offsetPh := arg(f.Limit), arg((f.Page-1)*f.Limit)
	rows, err := s.db.Query(ctx, fmt.Sprintf("select %s %s order by %s, p.id limit %s offset %s",
		productColumns, from, order, limitPh, offsetPh), args...)
	if err != nil {
		return models.ProductPage{}, err
	}
	defer rows.Close()
	items := []models.Product{}
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return models.ProductPage{}, err
		}
		items = append(items, p)
	}
	return models.ProductPage{Items: items, Total: total, Page: f.Page, Limit: f.Limit}, rows.Err()
}

func (s *Store) GetProductBySlug(ctx context.Context, slug string) (models.Product, error) {
	p, err := scanProduct(s.db.QueryRow(ctx, `select `+productColumns+`
		from products p left join categories c on c.id = p.category_id where p.slug=$1 and p.is_active`, slug))
	return p, mapErr(err)
}

func (s *Store) GetProduct(ctx context.Context, id string) (models.Product, error) {
	p, err := scanProduct(s.db.QueryRow(ctx, `select `+productColumns+`
		from products p left join categories c on c.id = p.category_id where p.id=$1`, id))
	return p, mapErr(err)
}

func (s *Store) RelatedProducts(ctx context.Context, p models.Product, limit int) ([]models.Product, error) {
	rows, err := s.db.Query(ctx, `select `+productColumns+`
		from products p left join categories c on c.id = p.category_id
		where p.is_active and p.id <> $1
		order by (p.category_id is not distinct from $2) desc, p.is_featured desc, p.rating desc
		limit $3`, p.ID, p.CategoryID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Product{}
	for rows.Next() {
		rp, err := scanProduct(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, rp)
	}
	return out, rows.Err()
}

func normalizeProduct(in *models.ProductInput) error {
	in.Name = strings.TrimSpace(in.Name)
	in.SKU = strings.TrimSpace(in.SKU)
	if in.Name == "" || in.SKU == "" || in.Price < 0 || in.Stock < 0 {
		return ErrInvalid
	}
	if in.Slug == "" {
		in.Slug = Slugify(in.Name)
	} else {
		in.Slug = Slugify(in.Slug)
	}
	if in.CategoryID != nil && *in.CategoryID == "" {
		in.CategoryID = nil
	}
	if in.CompareAtPrice != nil && *in.CompareAtPrice <= 0 {
		in.CompareAtPrice = nil
	}
	if in.LowStockThreshold <= 0 {
		in.LowStockThreshold = 5
	}
	in.Images, in.Colors, in.Sizes = nonNil(in.Images), nonNil(in.Colors), nonNil(in.Sizes)
	for _, img := range in.Images {
		if !validImageURL(img) {
			return fmt.Errorf("%w: image URLs must start with https://", ErrInvalid)
		}
	}
	return nil
}

func (s *Store) CreateProduct(ctx context.Context, in models.ProductInput, actor string) (models.Product, error) {
	if err := normalizeProduct(&in); err != nil {
		return models.Product{}, err
	}
	var id string
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `
			insert into products (category_id, name, slug, sku, short_description, description, price, compare_at_price,
				stock, low_stock_threshold, images, colors, sizes, material, badge, is_featured, is_active)
			values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id`,
			in.CategoryID, in.Name, in.Slug, in.SKU, in.ShortDescription, in.Description, in.Price, in.CompareAtPrice,
			in.Stock, in.LowStockThreshold, in.Images, in.Colors, in.Sizes, in.Material, in.Badge, in.IsFeatured,
			in.IsActive).Scan(&id)
		if err != nil {
			return err
		}
		if in.Stock > 0 {
			_, err = tx.Exec(ctx, `insert into inventory_movements (product_id, change, reason, actor) values ($1,$2,'Opening stock',$3)`, id, in.Stock, actor)
		}
		return err
	})
	if err != nil {
		return models.Product{}, mapErr(err)
	}
	return s.GetProduct(ctx, id)
}

// UpdateProduct edits product details. Stock changes made through this
// endpoint are recorded as a manual adjustment in the inventory log.
func (s *Store) UpdateProduct(ctx context.Context, id string, in models.ProductInput, actor string) (models.Product, error) {
	if err := normalizeProduct(&in); err != nil {
		return models.Product{}, err
	}
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var oldStock int
		if err := tx.QueryRow(ctx, `select stock from products where id=$1 for update`, id).Scan(&oldStock); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `
			update products set category_id=$2, name=$3, slug=$4, sku=$5, short_description=$6, description=$7,
				price=$8, compare_at_price=$9, stock=$10, low_stock_threshold=$11, images=$12, colors=$13, sizes=$14,
				material=$15, badge=$16, is_featured=$17, is_active=$18, updated_at=now()
			where id=$1`,
			id, in.CategoryID, in.Name, in.Slug, in.SKU, in.ShortDescription, in.Description, in.Price,
			in.CompareAtPrice, in.Stock, in.LowStockThreshold, in.Images, in.Colors, in.Sizes, in.Material,
			in.Badge, in.IsFeatured, in.IsActive)
		if err != nil {
			return err
		}
		if diff := in.Stock - oldStock; diff != 0 {
			_, err = tx.Exec(ctx, `insert into inventory_movements (product_id, change, reason, actor) values ($1,$2,'Manual edit',$3)`, id, diff, actor)
		}
		return err
	})
	if err != nil {
		return models.Product{}, mapErr(err)
	}
	return s.GetProduct(ctx, id)
}

func (s *Store) DeleteProduct(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `delete from products where id=$1`, id)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// AdjustStock applies a relative stock change (restock, damage, count
// correction) and records it in the inventory log.
func (s *Store) AdjustStock(ctx context.Context, id string, change int, reason, actor string) (models.Product, error) {
	if change == 0 || strings.TrimSpace(reason) == "" {
		return models.Product{}, ErrInvalid
	}
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `update products set stock = stock + $2, updated_at=now() where id=$1 and stock + $2 >= 0`, id, change)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			var exists bool
			_ = tx.QueryRow(ctx, `select exists(select 1 from products where id=$1)`, id).Scan(&exists)
			if !exists {
				return ErrNotFound
			}
			return ErrInsufficient
		}
		_, err = tx.Exec(ctx, `insert into inventory_movements (product_id, change, reason, actor) values ($1,$2,$3,$4)`, id, change, reason, actor)
		return err
	})
	if err != nil {
		if err == ErrNotFound || err == ErrInsufficient {
			return models.Product{}, err
		}
		return models.Product{}, mapErr(err)
	}
	return s.GetProduct(ctx, id)
}

func (s *Store) ListMovements(ctx context.Context, productID string, limit int) ([]models.InventoryMovement, error) {
	_, limit = clampPage(1, limit, 50, 500)
	rows, err := s.db.Query(ctx, `
		select m.id, m.product_id, p.name, m.change, m.reason, coalesce(o.reference, iv.number), m.actor, m.created_at
		from inventory_movements m
		join products p on p.id = m.product_id
		left join orders o on o.id = m.order_id
		left join invoices iv on iv.id = m.invoice_id
		where ($1 = '' or m.product_id::text = $1)
		order by m.created_at desc limit $2`, productID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.InventoryMovement{}
	for rows.Next() {
		var m models.InventoryMovement
		if err := rows.Scan(&m.ID, &m.ProductID, &m.ProductName, &m.Change, &m.Reason, &m.OrderRef, &m.Actor, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}
