package store

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"math"
	"net/mail"
	"slices"
	"strconv"
	"strings"
	"time"

	"chrismoore-decor/backend/internal/models"

	"github.com/jackc/pgx/v5"
)

const invoiceColumns = `i.id, i.number, i.token, i.customer_name, i.email, i.phone, i.address, i.notes,
	i.subtotal, i.discount, i.delivery_fee, i.tax_rate_bp, i.tax, i.total, i.status,
	coalesce(i.status='unpaid' and i.due_date < (now() at time zone 'Africa/Lagos')::date, false),
	coalesce(to_char(i.due_date, 'YYYY-MM-DD'), ''), i.payment_provider, i.paid_at, i.created_by_name,
	i.created_at, i.updated_at`

func scanInvoice(row pgx.Row) (models.Invoice, error) {
	var inv models.Invoice
	var bp int
	err := row.Scan(&inv.ID, &inv.Number, &inv.Token, &inv.CustomerName, &inv.Email, &inv.Phone, &inv.Address, &inv.Notes,
		&inv.Subtotal, &inv.Discount, &inv.DeliveryFee, &bp, &inv.Tax, &inv.Total, &inv.Status,
		&inv.Overdue, &inv.DueDate, &inv.PaymentProvider, &inv.PaidAt, &inv.CreatedByName,
		&inv.CreatedAt, &inv.UpdatedAt)
	inv.TaxRate = float64(bp) / 100
	return inv, err
}

// InvoiceTotals computes the invoice amounts in kobo. Tax applies to the
// discounted subtotal; delivery is added after tax.
func InvoiceTotals(items []models.InvoiceItemInput, discount, delivery int64, taxBP int) (subtotal, tax, total int64) {
	for _, it := range items {
		subtotal += int64(it.Quantity) * it.UnitPrice
	}
	taxable := max(subtotal-discount, 0)
	tax = int64(math.Round(float64(taxable) * float64(taxBP) / 10000))
	return subtotal, tax, taxable + tax + delivery
}

// NormalizeInvoice trims and validates an invoice before saving.
func NormalizeInvoice(in *models.InvoiceInput) (taxBP int, err error) {
	in.CustomerName = strings.TrimSpace(in.CustomerName)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.Phone = strings.TrimSpace(in.Phone)
	in.Address = strings.TrimSpace(in.Address)
	in.Notes = strings.TrimSpace(in.Notes)
	in.DueDate = strings.TrimSpace(in.DueDate)
	switch {
	case in.CustomerName == "":
		return 0, invalid("enter the customer's name")
	case len(in.Items) == 0:
		return 0, invalid("add at least one item")
	case len(in.Items) > 100:
		return 0, invalid("too many items (100 max)")
	case len([]rune(in.Notes)) > 2000:
		return 0, invalid("notes are too long (2000 characters max)")
	case in.Discount < 0 || in.DeliveryFee < 0:
		return 0, invalid("discount and delivery can't be negative")
	case in.TaxRate < 0 || in.TaxRate > 100 || math.IsNaN(in.TaxRate):
		return 0, invalid("tax rate must be between 0 and 100%")
	}
	if in.Email != "" {
		if a, err := mail.ParseAddress(in.Email); err != nil || a.Address != in.Email {
			return 0, invalid("enter a valid customer email, or leave it blank")
		}
	}
	if in.DueDate != "" {
		if _, err := time.Parse("2006-01-02", in.DueDate); err != nil {
			return 0, invalid("due date must be a valid date")
		}
	}
	for i := range in.Items {
		it := &in.Items[i]
		it.Description = strings.TrimSpace(it.Description)
		it.ProductID = strings.TrimSpace(it.ProductID)
		switch {
		case it.Description == "":
			return 0, invalid("item " + strconv.Itoa(i+1) + " needs a description")
		case len([]rune(it.Description)) > 300:
			return 0, invalid("item " + strconv.Itoa(i+1) + " description is too long")
		case it.Quantity < 1 || it.Quantity > 100000:
			return 0, invalid("item " + strconv.Itoa(i+1) + " quantity must be at least 1")
		case it.UnitPrice < 0 || it.UnitPrice > 1e13:
			return 0, invalid("item " + strconv.Itoa(i+1) + " has an invalid price")
		}
	}
	taxBP = int(math.Round(in.TaxRate * 100))
	subtotal, _, total := InvoiceTotals(in.Items, in.Discount, in.DeliveryFee, taxBP)
	if in.Discount > subtotal {
		return 0, invalid("discount can't be more than the subtotal")
	}
	if total < 10000 {
		return 0, invalid("invoice total must be at least ₦100")
	}
	return taxBP, nil
}

// ---------- Stock reservation ----------
//
// Catalogue lines on an invoice hold stock while the invoice is unpaid or
// paid, the same way website orders do. Voiding or deleting an unpaid
// invoice returns it; reopening a void invoice takes it again. Free-typed
// lines (no product) never touch stock.

// productQty totals quantities per catalogue product.
func productQty(items []models.InvoiceItemInput) map[string]int {
	out := map[string]int{}
	for _, it := range items {
		if it.ProductID != "" {
			out[it.ProductID] += it.Quantity
		}
	}
	return out
}

// reservedQty is what an invoice's current lines hold, per product.
func reservedQty(ctx context.Context, tx pgx.Tx, invoiceID string) (map[string]int, error) {
	rows, err := tx.Query(ctx, `select product_id::text, sum(quantity) from invoice_items
		where invoice_id=$1 and product_id is not null group by product_id`, invoiceID)
	if err != nil {
		return nil, err
	}
	out := map[string]int{}
	for rows.Next() {
		var id string
		var n int
		if err := rows.Scan(&id, &n); err != nil {
			rows.Close()
			return nil, err
		}
		out[id] = n
	}
	rows.Close()
	return out, rows.Err()
}

// stockDelta is how much more stock each product needs: want - have.
func stockDelta(want, have map[string]int) map[string]int {
	out := map[string]int{}
	for id, n := range want {
		out[id] += n
	}
	for id, n := range have {
		out[id] -= n
	}
	return out
}

func negate(m map[string]int) map[string]int {
	out := map[string]int{}
	for k, v := range m {
		out[k] = -v
	}
	return out
}

// checkInvoiceStock locks the products in delta (in a consistent order, to
// avoid deadlocks) and fails with a StockError if any can't cover its
// increase. It returns the products to update.
func checkInvoiceStock(ctx context.Context, tx pgx.Tx, delta map[string]int) ([]string, error) {
	ids := make([]string, 0, len(delta))
	for id, d := range delta {
		if d != 0 {
			ids = append(ids, id)
		}
	}
	slices.Sort(ids)
	for _, id := range ids {
		var name string
		var stock int
		err := tx.QueryRow(ctx, `select name, stock from products where id=$1 for update`, id).Scan(&name, &stock)
		if errors.Is(err, pgx.ErrNoRows) {
			if delta[id] > 0 {
				return nil, invalid("a product on this invoice no longer exists; remove it or pick another")
			}
			continue // product deleted: nothing to return
		}
		if err != nil {
			return nil, err
		}
		if delta[id] > stock {
			return nil, &StockError{Product: name, Available: stock}
		}
	}
	return ids, nil
}

// moveInvoiceStock takes (delta > 0) or returns (delta < 0) stock for an
// invoice and logs each movement. Everything is checked first, so nothing
// changes if any product is short.
func moveInvoiceStock(ctx context.Context, tx pgx.Tx, invoiceID string, delta map[string]int, reason, actor string) error {
	ids, err := checkInvoiceStock(ctx, tx, delta)
	if err != nil {
		return err
	}
	for _, id := range ids {
		tag, err := tx.Exec(ctx, `update products set stock = stock - $2, updated_at=now() where id=$1`, id, delta[id])
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			continue
		}
		if _, err := tx.Exec(ctx, `insert into inventory_movements (product_id, change, reason, invoice_id, actor)
			values ($1,$2,$3,$4,$5)`, id, -delta[id], reason, invoiceID, actor); err != nil {
			return err
		}
	}
	return nil
}

func writeInvoiceItems(ctx context.Context, tx pgx.Tx, invoiceID string, items []models.InvoiceItemInput) error {
	if _, err := tx.Exec(ctx, `delete from invoice_items where invoice_id=$1`, invoiceID); err != nil {
		return err
	}
	for i, it := range items {
		if _, err := tx.Exec(ctx, `insert into invoice_items (invoice_id, product_id, description, quantity, unit_price, position)
			values ($1, nullif($2,'')::uuid, $3, $4, $5, $6)`, invoiceID, it.ProductID, it.Description, it.Quantity, it.UnitPrice, i); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) CreateInvoice(ctx context.Context, in models.InvoiceInput, by models.AdminUser) (models.Invoice, error) {
	taxBP, err := NormalizeInvoice(&in)
	if err != nil {
		return models.Invoice{}, err
	}
	subtotal, tax, total := InvoiceTotals(in.Items, in.Discount, in.DeliveryFee, taxBP)
	var id, number string
	err = pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		// Check stock before taking an invoice number, so a refused invoice
		// doesn't leave a gap in the numbering.
		if _, err := checkInvoiceStock(ctx, tx, productQty(in.Items)); err != nil {
			return err
		}
		if err := tx.QueryRow(ctx, `insert into invoices (number, token, customer_name, email, phone, address, notes,
				subtotal, discount, delivery_fee, tax_rate_bp, tax, total, due_date, created_by, created_by_name)
			values ('INV-' || lpad(nextval('invoice_number_seq')::text, 5, '0'), $1, $2, $3, $4, $5, $6,
				$7, $8, $9, $10, $11, $12, nullif($13,'')::date, nullif($14,'')::uuid, $15)
			returning id, number`,
			NewReference("", 20), in.CustomerName, in.Email, in.Phone, in.Address, in.Notes,
			subtotal, in.Discount, in.DeliveryFee, taxBP, tax, total, in.DueDate, by.ID, by.Name).Scan(&id, &number); err != nil {
			return err
		}
		if err := moveInvoiceStock(ctx, tx, id, productQty(in.Items), "Invoice "+number+" created", actorName(by)); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `update invoices set stock_reserved=true where id=$1`, id); err != nil {
			return err
		}
		return writeInvoiceItems(ctx, tx, id, in.Items)
	})
	if err != nil {
		return models.Invoice{}, mapErr(err)
	}
	return s.GetInvoice(ctx, id)
}

// UpdateInvoice edits an unpaid invoice. Paid and void invoices are locked.
func (s *Store) UpdateInvoice(ctx context.Context, id string, in models.InvoiceInput, actor string) (models.Invoice, error) {
	taxBP, err := NormalizeInvoice(&in)
	if err != nil {
		return models.Invoice{}, err
	}
	subtotal, tax, total := InvoiceTotals(in.Items, in.Discount, in.DeliveryFee, taxBP)
	err = pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var status, number string
		var reserved bool
		if err := tx.QueryRow(ctx, `select status, number, stock_reserved from invoices where id=$1 for update`, id).Scan(&status, &number, &reserved); err != nil {
			return err
		}
		if status != "unpaid" {
			return invalid("only unpaid invoices can be edited")
		}
		// Only the difference between old and new lines moves stock.
		if reserved {
			have, err := reservedQty(ctx, tx, id)
			if err != nil {
				return err
			}
			if err := moveInvoiceStock(ctx, tx, id, stockDelta(productQty(in.Items), have), "Invoice "+number+" edited", actor); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(ctx, `update invoices set customer_name=$2, email=$3, phone=$4, address=$5, notes=$6,
				subtotal=$7, discount=$8, delivery_fee=$9, tax_rate_bp=$10, tax=$11, total=$12,
				due_date=nullif($13,'')::date, updated_at=now()
			where id=$1`, id, in.CustomerName, in.Email, in.Phone, in.Address, in.Notes,
			subtotal, in.Discount, in.DeliveryFee, taxBP, tax, total, in.DueDate); err != nil {
			return err
		}
		return writeInvoiceItems(ctx, tx, id, in.Items)
	})
	if err != nil {
		return models.Invoice{}, mapErr(err)
	}
	return s.GetInvoice(ctx, id)
}

func (s *Store) loadInvoiceItems(ctx context.Context, inv *models.Invoice) error {
	rows, err := s.db.Query(ctx, `select id, product_id::text, description, quantity, unit_price
		from invoice_items where invoice_id=$1 order by position`, inv.ID)
	if err != nil {
		return err
	}
	inv.Items, err = pgx.CollectRows(rows, func(r pgx.CollectableRow) (models.InvoiceItem, error) {
		var it models.InvoiceItem
		err := r.Scan(&it.ID, &it.ProductID, &it.Description, &it.Quantity, &it.UnitPrice)
		it.Amount = int64(it.Quantity) * it.UnitPrice
		return it, err
	})
	if inv.Items == nil {
		inv.Items = []models.InvoiceItem{}
	}
	return err
}

func (s *Store) getInvoiceWhere(ctx context.Context, where string, arg any) (models.Invoice, error) {
	inv, err := scanInvoice(s.db.QueryRow(ctx, `select `+invoiceColumns+` from invoices i where `+where, arg))
	if err != nil {
		return inv, mapErr(err)
	}
	return inv, mapErr(s.loadInvoiceItems(ctx, &inv))
}

func (s *Store) GetInvoice(ctx context.Context, id string) (models.Invoice, error) {
	return s.getInvoiceWhere(ctx, `i.id=$1`, id)
}

// GetInvoiceByToken looks up an invoice by its public link token.
func (s *Store) GetInvoiceByToken(ctx context.Context, token string) (models.Invoice, error) {
	return s.getInvoiceWhere(ctx, `i.token=$1`, strings.ToUpper(strings.TrimSpace(token)))
}

func (s *Store) ListInvoices(ctx context.Context, f models.InvoiceFilter) (models.InvoicePage, error) {
	f.Page, f.Limit = clampPage(f.Page, f.Limit, 20, 100)
	var where []string
	var args []any
	arg := func(v any) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	switch f.Status {
	case "unpaid", "paid", "void":
		where = append(where, "i.status = "+arg(f.Status))
	case "overdue":
		where = append(where, "i.status='unpaid' and i.due_date < (now() at time zone 'Africa/Lagos')::date")
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		p := arg("%" + q + "%")
		where = append(where, "(i.number ilike "+p+" or i.customer_name ilike "+p+" or i.email ilike "+p+" or i.phone ilike "+p+")")
	}
	cond := ""
	if len(where) > 0 {
		cond = " where " + strings.Join(where, " and ")
	}
	page := models.InvoicePage{Page: f.Page, Limit: f.Limit, Items: []models.Invoice{}}
	if err := s.db.QueryRow(ctx, `select count(*) from invoices i`+cond, args...).Scan(&page.Total); err != nil {
		return page, mapErr(err)
	}
	rows, err := s.db.Query(ctx, `select `+invoiceColumns+` from invoices i`+cond+
		` order by i.created_at desc limit `+arg(f.Limit)+` offset `+arg((f.Page-1)*f.Limit), args...)
	if err != nil {
		return page, mapErr(err)
	}
	items, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (models.Invoice, error) {
		inv, err := scanInvoice(r)
		inv.Items = []models.InvoiceItem{}
		return inv, err
	})
	if items != nil {
		page.Items = items
	}
	return page, mapErr(err)
}

// SetInvoiceStatus marks an invoice paid (e.g. after a bank transfer),
// voids it, or reopens it. A paid invoice can only be reopened if it was
// marked paid by hand, never after an online payment.
func (s *Store) SetInvoiceStatus(ctx context.Context, id, status, actor string) (models.Invoice, error) {
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var cur, provider, number string
		var reserved bool
		if err := tx.QueryRow(ctx, `select status, payment_provider, number, stock_reserved from invoices where id=$1 for update`, id).
			Scan(&cur, &provider, &number, &reserved); err != nil {
			return err
		}
		if cur == status {
			return nil
		}
		// Voiding releases the reserved stock; reopening a void invoice takes it again.
		if reserved && (cur == "void" || status == "void") {
			held, err := reservedQty(ctx, tx, id)
			if err != nil {
				return err
			}
			if status == "void" && cur == "unpaid" {
				if err := moveInvoiceStock(ctx, tx, id, negate(held), "Invoice "+number+" voided", actor); err != nil {
					return err
				}
			}
			if cur == "void" && status == "unpaid" {
				if err := moveInvoiceStock(ctx, tx, id, held, "Invoice "+number+" reopened", actor); err != nil {
					return err
				}
			}
		}
		var q string
		switch {
		case status == "paid" && cur == "unpaid":
			q = `update invoices set status='paid', payment_provider='manual', paid_at=now(), updated_at=now() where id=$1`
		case status == "void" && cur == "unpaid":
			q = `update invoices set status='void', updated_at=now() where id=$1`
		case status == "unpaid" && cur == "void":
			q = `update invoices set status='unpaid', updated_at=now() where id=$1`
		case status == "unpaid" && cur == "paid" && provider == "manual":
			q = `update invoices set status='unpaid', payment_provider='', paid_at=null, updated_at=now() where id=$1`
		case cur == "paid":
			return invalid("this invoice was paid online and can't be changed")
		default:
			return invalid("can't change a " + cur + " invoice to " + status)
		}
		_, err := tx.Exec(ctx, q, id)
		return err
	})
	if err != nil {
		return models.Invoice{}, mapErr(err)
	}
	return s.GetInvoice(ctx, id)
}

// DeleteInvoice removes an invoice that hasn't been paid, returning any
// stock it still holds.
func (s *Store) DeleteInvoice(ctx context.Context, id, actor string) error {
	return mapErr(pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var status, number string
		var reserved bool
		if err := tx.QueryRow(ctx, `select status, number, stock_reserved from invoices where id=$1 for update`, id).Scan(&status, &number, &reserved); err != nil {
			return err
		}
		if status == "paid" {
			return invalid("paid invoices can't be deleted; keep them for your records")
		}
		if status == "unpaid" && reserved {
			held, err := reservedQty(ctx, tx, id)
			if err != nil {
				return err
			}
			if err := moveInvoiceStock(ctx, tx, id, negate(held), "Invoice "+number+" deleted", actor); err != nil {
				return err
			}
		}
		_, err := tx.Exec(ctx, `delete from invoices where id=$1`, id)
		return err
	}))
}

// SetInvoiceEmail stores the email a customer entered to pay online, if the
// invoice had none.
func (s *Store) SetInvoiceEmail(ctx context.Context, id, email string) error {
	_, err := s.db.Exec(ctx, `update invoices set email=$2, updated_at=now() where id=$1 and email=''`, id, email)
	return mapErr(err)
}

func (s *Store) CreateInvoicePayment(ctx context.Context, invoiceID, provider, reference string, amount int64) error {
	_, err := s.db.Exec(ctx, `insert into payments (invoice_id, provider, reference, amount) values ($1,$2,$3,$4)`,
		invoiceID, provider, reference, amount)
	return mapErr(err)
}

// RecordInvoicePaymentResult stores a verified provider result for an
// invoice payment. Like orders, a successful payment is never downgraded.
// newlyPaid is true only for the call that marked the invoice paid.
func (s *Store) RecordInvoicePaymentResult(ctx context.Context, reference string, success bool, raw any) (models.Invoice, bool, error) {
	rawJSON, _ := json.Marshal(raw)
	var invoiceID string
	newlyPaid := false
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var status, provider string
		if err := tx.QueryRow(ctx, `select invoice_id, status, provider from payments where reference=$1 and invoice_id is not null for update`, reference).
			Scan(&invoiceID, &status, &provider); err != nil {
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
		if !success {
			return nil
		}
		// Money was received, so the invoice is paid even if it had been voided
		// meanwhile. A voided invoice had released its stock: take it again if
		// it's still there, otherwise leave stock for the owner to sort out.
		var invStatus, number string
		var reserved bool
		if err := tx.QueryRow(ctx, `select status, number, stock_reserved from invoices where id=$1 for update`, invoiceID).Scan(&invStatus, &number, &reserved); err != nil {
			return err
		}
		if invStatus == "void" && reserved {
			held, err := reservedQty(ctx, tx, invoiceID)
			if err != nil {
				return err
			}
			err = moveInvoiceStock(ctx, tx, invoiceID, held, "Invoice "+number+" paid after being voided", "system")
			var se *StockError
			if errors.As(err, &se) {
				log.Printf("invoice %s paid after being voided, but stock is short (%v); adjust inventory by hand", number, se)
			} else if err != nil {
				return err
			}
		}
		tag, err := tx.Exec(ctx, `update invoices set status='paid', payment_provider=$2, paid_at=now(), updated_at=now()
			where id=$1 and status <> 'paid'`, invoiceID, provider)
		newlyPaid = err == nil && tag.RowsAffected() > 0
		return err
	})
	if err != nil {
		return models.Invoice{}, false, mapErr(err)
	}
	inv, err := s.GetInvoice(ctx, invoiceID)
	return inv, newlyPaid, err
}

// actorName labels inventory movements with who made the change.
func actorName(u models.AdminUser) string {
	if u.Email != "" {
		return u.Email
	}
	return "system"
}
