package store

import (
	"context"
	"strings"

	"chrismoore-decor/backend/internal/models"
)

// ---------- Admin users ----------

func (s *Store) AdminByEmail(ctx context.Context, email string) (models.AdminUser, error) {
	var u models.AdminUser
	err := s.db.QueryRow(ctx, `select id, email, name, role, password_hash, created_at from admin_users where email=$1`,
		strings.ToLower(strings.TrimSpace(email))).Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.PasswordHash, &u.CreatedAt)
	return u, mapErr(err)
}

func (s *Store) AdminByID(ctx context.Context, id string) (models.AdminUser, error) {
	var u models.AdminUser
	err := s.db.QueryRow(ctx, `select id, email, name, role, password_hash, created_at from admin_users where id=$1`, id).
		Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.PasswordHash, &u.CreatedAt)
	return u, mapErr(err)
}

func (s *Store) CountAdmins(ctx context.Context) (int, error) {
	var n int
	err := s.db.QueryRow(ctx, `select count(*) from admin_users`).Scan(&n)
	return n, err
}

func (s *Store) CreateAdmin(ctx context.Context, email, name, hash, role string) error {
	_, err := s.db.Exec(ctx, `insert into admin_users (email, name, password_hash, role) values ($1,$2,$3,$4)`,
		strings.ToLower(strings.TrimSpace(email)), name, hash, role)
	return mapErr(err)
}

func (s *Store) UpdateAdminPassword(ctx context.Context, id, hash string) error {
	_, err := s.db.Exec(ctx, `update admin_users set password_hash=$2 where id=$1`, id, hash)
	return mapErr(err)
}

// ---------- Settings ----------

// PublicSettingKeys are safe to expose to the storefront.
var PublicSettingKeys = []string{"store_name", "whatsapp_number", "contact_email", "contact_phone", "address",
	"shipping_fee", "free_shipping_threshold", "announcement", "instagram", "facebook", "opening_hours"}

func (s *Store) GetSettings(ctx context.Context) (map[string]string, error) {
	rows, err := s.db.Query(ctx, `select key, value from store_settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		out[k] = v
	}
	return out, rows.Err()
}

func (s *Store) UpdateSettings(ctx context.Context, in map[string]string) error {
	allowed := map[string]bool{}
	for _, k := range PublicSettingKeys {
		allowed[k] = true
	}
	for k, v := range in {
		if !allowed[k] {
			continue
		}
		if _, err := s.db.Exec(ctx, `insert into store_settings (key, value) values ($1,$2)
			on conflict (key) do update set value=excluded.value, updated_at=now()`, k, strings.TrimSpace(v)); err != nil {
			return err
		}
	}
	return nil
}

// ---------- Newsletter ----------

func (s *Store) Subscribe(ctx context.Context, email string) error {
	_, err := s.db.Exec(ctx, `insert into newsletter_subscribers (email) values ($1) on conflict do nothing`,
		strings.ToLower(strings.TrimSpace(email)))
	return err
}

type Subscriber struct {
	Email     string `json:"email"`
	CreatedAt string `json:"created_at"`
}

func (s *Store) ListSubscribers(ctx context.Context) ([]Subscriber, error) {
	rows, err := s.db.Query(ctx, `select email, to_char(created_at, 'YYYY-MM-DD HH24:MI') from newsletter_subscribers order by created_at desc`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Subscriber{}
	for rows.Next() {
		var x Subscriber
		if err := rows.Scan(&x.Email, &x.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

// ---------- Dashboard ----------

func (s *Store) Stats(ctx context.Context) (models.DashboardStats, error) {
	var st models.DashboardStats
	err := s.db.QueryRow(ctx, `
		select
		  coalesce(sum(total) filter (where payment_status='paid'),0),
		  coalesce(sum(total) filter (where payment_status='paid' and paid_at >= date_trunc('month', now())),0),
		  count(*) filter (where status <> 'cancelled'),
		  count(*) filter (where status in ('pending','confirmed','processing')),
		  count(*) filter (where created_at >= date_trunc('day', now()))
		from orders`).Scan(&st.Revenue, &st.RevenueThisMonth, &st.OrdersTotal, &st.OrdersPending, &st.OrdersToday)
	if err != nil {
		return st, err
	}
	err = s.db.QueryRow(ctx, `
		select count(*) filter (where is_active),
		       count(*) filter (where is_active and stock > 0 and stock <= low_stock_threshold),
		       count(*) filter (where is_active and stock = 0),
		       coalesce(sum(price::numeric * stock),0)::bigint
		from products`).Scan(&st.ProductsActive, &st.LowStock, &st.OutOfStock, &st.InventoryValue)
	if err != nil {
		return st, err
	}
	if err := s.db.QueryRow(ctx, `select count(*) from newsletter_subscribers`).Scan(&st.Subscribers); err != nil {
		return st, err
	}
	if err := s.db.QueryRow(ctx, `select count(*) from product_reviews where status = 'pending'`).Scan(&st.ReviewsPending); err != nil {
		return st, err
	}

	rows, err := s.db.Query(ctx, `
		select to_char(d::date, 'YYYY-MM-DD'),
		       coalesce(sum(o.total) filter (where o.payment_status='paid'),0),
		       count(o.id)
		from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
		left join orders o on date_trunc('day', o.created_at) = d and o.status <> 'cancelled'
		group by d order by d`)
	if err != nil {
		return st, err
	}
	for rows.Next() {
		var d models.DailySales
		if err := rows.Scan(&d.Day, &d.Revenue, &d.Orders); err != nil {
			rows.Close()
			return st, err
		}
		st.SalesByDay = append(st.SalesByDay, d)
	}
	rows.Close()

	st.ChannelSplit = map[string]int{"whatsapp": 0, "paystack": 0, "flutterwave": 0}
	rows, err = s.db.Query(ctx, `select channel, count(*) from orders where status <> 'cancelled' group by channel`)
	if err != nil {
		return st, err
	}
	for rows.Next() {
		var ch string
		var n int
		if err := rows.Scan(&ch, &n); err != nil {
			rows.Close()
			return st, err
		}
		st.ChannelSplit[ch] = n
	}
	rows.Close()

	rows, err = s.db.Query(ctx, `
		select coalesce(i.product_id::text,''), i.product_name, max(i.image_url), sum(i.quantity), sum(i.quantity * i.unit_price)
		from order_items i join orders o on o.id = i.order_id
		where o.status <> 'cancelled'
		group by i.product_id, i.product_name order by sum(i.quantity) desc limit 5`)
	if err != nil {
		return st, err
	}
	st.TopProducts = []models.TopProduct{}
	for rows.Next() {
		var t models.TopProduct
		if err := rows.Scan(&t.ProductID, &t.Name, &t.ImageURL, &t.Units, &t.Revenue); err != nil {
			rows.Close()
			return st, err
		}
		st.TopProducts = append(st.TopProducts, t)
	}
	rows.Close()

	recent, err := s.ListOrders(ctx, models.OrderFilter{Limit: 6})
	if err != nil {
		return st, err
	}
	st.RecentOrders = recent.Items

	low, err := s.ListProducts(ctx, models.ProductFilter{LowStockOnly: true, Sort: "stock", Limit: 8})
	if err != nil {
		return st, err
	}
	st.LowStockProducts = low.Items
	return st, nil
}
