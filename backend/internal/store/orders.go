package store

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"chrismoore-decor/backend/internal/models"

	"github.com/jackc/pgx/v5"
)

// StockError tells the shopper exactly which item could not be fulfilled.
type StockError struct {
	Product   string
	Available int
}

func (e *StockError) Error() string {
	if e.Available <= 0 {
		return fmt.Sprintf("%s is out of stock", e.Product)
	}
	return fmt.Sprintf("only %d of %s left in stock", e.Available, e.Product)
}

func (e *StockError) Unwrap() error { return ErrInsufficient }

var ValidStatuses = []string{"pending", "confirmed", "processing", "shipped", "delivered", "cancelled"}

const refAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func NewReference(prefix string, n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = refAlphabet[int(b[i])%len(refAlphabet)]
	}
	return prefix + string(b)
}

const orderColumns = `o.id, o.reference, o.customer_name, o.email, o.phone, o.address, o.city, o.state, o.notes,
	o.subtotal, o.shipping_fee, o.total, o.channel, o.status, o.payment_status, o.payment_provider, o.paid_at,
	o.created_at, o.updated_at,
	(select coalesce(sum(quantity),0) from order_items i where i.order_id = o.id)`

func scanOrder(row pgx.Row) (models.Order, error) {
	var o models.Order
	err := row.Scan(&o.ID, &o.Reference, &o.CustomerName, &o.Email, &o.Phone, &o.Address, &o.City, &o.State,
		&o.Notes, &o.Subtotal, &o.ShippingFee, &o.Total, &o.Channel, &o.Status, &o.PaymentStatus,
		&o.PaymentProvider, &o.PaidAt, &o.CreatedAt, &o.UpdatedAt, &o.ItemCount)
	o.Items = []models.OrderItem{}
	return o, err
}

// CreateOrder prices the cart from the database (never trusting client
// prices), reserves stock atomically and stores the order.
func (s *Store) CreateOrder(ctx context.Context, req models.CheckoutRequest) (models.Order, error) {
	settings, err := s.GetSettings(ctx)
	if err != nil {
		return models.Order{}, err
	}
	shippingFee, _ := strconv.ParseInt(settings["shipping_fee"], 10, 64)
	freeOver, _ := strconv.ParseInt(settings["free_shipping_threshold"], 10, 64)

	var orderID string
	err = pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		type line struct {
			item models.OrderItem
		}
		var lines []line
		var subtotal int64
		for _, it := range req.Items {
			var (
				id, name, sku string
				price         int64
				stock         int
				active        bool
				images        []string
				colors, sizes []string
			)
			err := tx.QueryRow(ctx, `select id, name, sku, price, stock, is_active, images, colors, sizes
				from products where id=$1 for update`, it.ProductID).
				Scan(&id, &name, &sku, &price, &stock, &active, &images, &colors, &sizes)
			if errors.Is(err, pgx.ErrNoRows) || (err == nil && !active) {
				return fmt.Errorf("%w: a product in your cart is no longer available", ErrInvalid)
			}
			if err != nil {
				return err
			}
			if it.Color != "" && !slices.Contains(colors, it.Color) {
				return fmt.Errorf("%w: %s is not available in %s", ErrInvalid, name, it.Color)
			}
			if it.Size != "" && !slices.Contains(sizes, it.Size) {
				return fmt.Errorf("%w: %s is not available in size %s", ErrInvalid, name, it.Size)
			}
			if stock < it.Quantity {
				return &StockError{Product: name, Available: stock}
			}
			if _, err := tx.Exec(ctx, `update products set stock = stock - $2, updated_at=now() where id=$1`, id, it.Quantity); err != nil {
				return err
			}
			img := ""
			if len(images) > 0 {
				img = images[0]
			}
			pid := id
			lines = append(lines, line{models.OrderItem{ProductID: &pid, ProductName: name, SKU: sku, ImageURL: img,
				UnitPrice: price, Quantity: it.Quantity, Color: it.Color, Size: it.Size}})
			subtotal += price * int64(it.Quantity)
		}

		fee := shippingFee
		if freeOver > 0 && subtotal >= freeOver {
			fee = 0
		}
		ref := NewReference("CM-", 8)
		err := tx.QueryRow(ctx, `
			insert into orders (reference, customer_name, email, phone, address, city, state, notes,
				subtotal, shipping_fee, total, channel)
			values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
			ref, req.CustomerName, req.Email, req.Phone, req.Address, req.City, req.State, req.Notes,
			subtotal, fee, subtotal+fee, req.Channel).Scan(&orderID)
		if err != nil {
			return err
		}
		for _, l := range lines {
			it := l.item
			if _, err := tx.Exec(ctx, `insert into order_items (order_id, product_id, product_name, sku, image_url,
				unit_price, quantity, color, size) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
				orderID, it.ProductID, it.ProductName, it.SKU, it.ImageURL, it.UnitPrice, it.Quantity, it.Color, it.Size); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, `insert into inventory_movements (product_id, change, reason, order_id, actor)
				values ($1,$2,'Order placed',$3,'customer')`, it.ProductID, -it.Quantity, orderID); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		var se *StockError
		if errors.As(err, &se) || errors.Is(err, ErrInvalid) {
			return models.Order{}, err
		}
		return models.Order{}, mapErr(err)
	}
	return s.GetOrderByID(ctx, orderID)
}

func (s *Store) loadItems(ctx context.Context, o *models.Order) error {
	rows, err := s.db.Query(ctx, `select id, product_id, product_name, sku, image_url, unit_price, quantity, color, size
		from order_items where order_id=$1 order by product_name`, o.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var it models.OrderItem
		if err := rows.Scan(&it.ID, &it.ProductID, &it.ProductName, &it.SKU, &it.ImageURL, &it.UnitPrice,
			&it.Quantity, &it.Color, &it.Size); err != nil {
			return err
		}
		o.Items = append(o.Items, it)
	}
	return rows.Err()
}

func (s *Store) GetOrderByID(ctx context.Context, id string) (models.Order, error) {
	o, err := scanOrder(s.db.QueryRow(ctx, `select `+orderColumns+` from orders o where o.id=$1`, id))
	if err != nil {
		return o, mapErr(err)
	}
	return o, s.loadItems(ctx, &o)
}

func (s *Store) GetOrderByReference(ctx context.Context, ref string) (models.Order, error) {
	o, err := scanOrder(s.db.QueryRow(ctx, `select `+orderColumns+` from orders o where o.reference=$1`, strings.ToUpper(ref)))
	if err != nil {
		return o, mapErr(err)
	}
	return o, s.loadItems(ctx, &o)
}

func (s *Store) ListOrders(ctx context.Context, f models.OrderFilter) (models.OrderPage, error) {
	f.Page, f.Limit = clampPage(f.Page, f.Limit, 20, 100)
	var where []string
	var args []any
	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}
	if f.Status != "" {
		where = append(where, "o.status = "+arg(f.Status))
	}
	if f.PaymentStatus != "" {
		where = append(where, "o.payment_status = "+arg(f.PaymentStatus))
	}
	if f.Channel != "" {
		where = append(where, "o.channel = "+arg(f.Channel))
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		ph := arg("%" + q + "%")
		where = append(where, fmt.Sprintf("(o.reference ilike %[1]s or o.customer_name ilike %[1]s or o.email ilike %[1]s or o.phone ilike %[1]s)", ph))
	}
	clause := ""
	if len(where) > 0 {
		clause = " where " + strings.Join(where, " and ")
	}
	var total int
	if err := s.db.QueryRow(ctx, "select count(*) from orders o"+clause, args...).Scan(&total); err != nil {
		return models.OrderPage{}, err
	}
	lp, op := arg(f.Limit), arg((f.Page-1)*f.Limit)
	rows, err := s.db.Query(ctx, "select "+orderColumns+" from orders o"+clause+
		" order by o.created_at desc limit "+lp+" offset "+op, args...)
	if err != nil {
		return models.OrderPage{}, err
	}
	defer rows.Close()
	items := []models.Order{}
	for rows.Next() {
		o, err := scanOrder(rows)
		if err != nil {
			return models.OrderPage{}, err
		}
		items = append(items, o)
	}
	return models.OrderPage{Items: items, Total: total, Page: f.Page, Limit: f.Limit}, rows.Err()
}

// restock returns an order's items to inventory inside tx.
func restock(ctx context.Context, tx pgx.Tx, orderID, reason, actor string) error {
	rows, err := tx.Query(ctx, `select product_id, quantity from order_items where order_id=$1 and product_id is not null`, orderID)
	if err != nil {
		return err
	}
	type pq struct {
		id  string
		qty int
	}
	var items []pq
	for rows.Next() {
		var x pq
		if err := rows.Scan(&x.id, &x.qty); err != nil {
			rows.Close()
			return err
		}
		items = append(items, x)
	}
	rows.Close()
	for _, it := range items {
		if _, err := tx.Exec(ctx, `update products set stock = stock + $2, updated_at=now() where id=$1`, it.id, it.qty); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `insert into inventory_movements (product_id, change, reason, order_id, actor)
			values ($1,$2,$3,$4,$5)`, it.id, it.qty, reason, orderID, actor); err != nil {
			return err
		}
	}
	return nil
}

// UpdateOrderStatus moves an order through its lifecycle. Cancelling
// returns reserved stock; a cancelled order cannot be reopened.
func (s *Store) UpdateOrderStatus(ctx context.Context, id, status, paymentStatus, actor string) (models.Order, error) {
	if status != "" && !slices.Contains(ValidStatuses, status) {
		return models.Order{}, ErrInvalid
	}
	if paymentStatus != "" && !slices.Contains([]string{"unpaid", "paid", "failed", "refunded"}, paymentStatus) {
		return models.Order{}, ErrInvalid
	}
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var cur, curPay string
		if err := tx.QueryRow(ctx, `select status, payment_status from orders where id=$1 for update`, id).Scan(&cur, &curPay); err != nil {
			return err
		}
		if status == "" {
			status = cur
		}
		if paymentStatus == "" {
			paymentStatus = curPay
		}
		if cur == "cancelled" && status != "cancelled" {
			return fmt.Errorf("%w: cancelled orders cannot be reopened", ErrInvalid)
		}
		if status == "cancelled" && cur != "cancelled" {
			if err := restock(ctx, tx, id, "Order cancelled", actor); err != nil {
				return err
			}
		}
		_, err := tx.Exec(ctx, `update orders set status=$2, payment_status=$3,
			paid_at = case when $3='paid' and paid_at is null then now() else paid_at end,
			updated_at=now() where id=$1`, id, status, paymentStatus)
		return err
	})
	if err != nil {
		if errors.Is(err, ErrInvalid) {
			return models.Order{}, err
		}
		return models.Order{}, mapErr(err)
	}
	return s.GetOrderByID(ctx, id)
}

// ExpireStaleOrders cancels online-payment orders that were never paid so
// their reserved stock goes back on sale. Returns the number cancelled.
func (s *Store) ExpireStaleOrders(ctx context.Context, olderThan time.Duration) (int, error) {
	rows, err := s.db.Query(ctx, `select id from orders
		where status='pending' and payment_status in ('unpaid','failed') and channel in ('paystack','flutterwave')
		  and created_at < now() - make_interval(secs => $1)`, olderThan.Seconds())
	if err != nil {
		return 0, err
	}
	ids, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return 0, err
	}
	n := 0
	for _, id := range ids {
		err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
			// Re-check under lock so we never cancel an order that just got paid.
			tag, err := tx.Exec(ctx, `update orders set status='cancelled', updated_at=now()
				where id=$1 and status='pending' and payment_status in ('unpaid','failed')`, id)
			if err != nil || tag.RowsAffected() == 0 {
				return err
			}
			n++
			return restock(ctx, tx, id, "Unpaid order expired", "system")
		})
		if err != nil {
			return n, err
		}
	}
	return n, nil
}

// ---------- Payments ----------

func (s *Store) CreatePayment(ctx context.Context, orderID, provider, reference string, amount int64) error {
	_, err := s.db.Exec(ctx, `insert into payments (order_id, provider, reference, amount) values ($1,$2,$3,$4)`,
		orderID, provider, reference, amount)
	if err == nil {
		_, err = s.db.Exec(ctx, `update orders set payment_provider=$2, updated_at=now() where id=$1`, orderID, provider)
	}
	return mapErr(err)
}

func (s *Store) GetPayment(ctx context.Context, reference string) (models.Payment, error) {
	var p models.Payment
	err := s.db.QueryRow(ctx, `select id, order_id, provider, reference, amount, status from payments where reference=$1`, reference).
		Scan(&p.ID, &p.OrderID, &p.Provider, &p.Reference, &p.Amount, &p.Status)
	return p, mapErr(err)
}

// RecordPaymentResult stores a verified provider result. It is idempotent:
// a payment already marked successful is never downgraded.
func (s *Store) RecordPaymentResult(ctx context.Context, reference string, success bool, raw any) (models.Order, error) {
	rawJSON, _ := json.Marshal(raw)
	var orderID string
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var status, provider string
		if err := tx.QueryRow(ctx, `select order_id, status, provider from payments where reference=$1 for update`, reference).
			Scan(&orderID, &status, &provider); err != nil {
			return err
		}
		if status == "success" {
			return nil
		}
		newStatus := "failed"
		if success {
			newStatus = "success"
		}
		if _, err := tx.Exec(ctx, `update payments set status=$2, raw=$3, updated_at=now() where reference=$1`,
			reference, newStatus, string(rawJSON)); err != nil {
			return err
		}
		if success {
			_, err := tx.Exec(ctx, `update orders set payment_status='paid', payment_provider=$2, paid_at=now(),
				status = case when status='pending' then 'confirmed' else status end, updated_at=now()
				where id=$1`, orderID, provider)
			return err
		}
		_, err := tx.Exec(ctx, `update orders set payment_status='failed', updated_at=now()
			where id=$1 and payment_status='unpaid'`, orderID)
		return err
	})
	if err != nil {
		return models.Order{}, mapErr(err)
	}
	return s.GetOrderByID(ctx, orderID)
}
