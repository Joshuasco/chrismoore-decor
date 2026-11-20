package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"chrismoore-decor/backend/internal/models"

	"github.com/jackc/pgx/v5"
)

// ---------- Suppliers ----------

const supplierColumns = `s.id::text, s.name, s.contact_person, s.email, s.phone, s.address, s.city, s.country,
	s.payment_terms, s.bank_details, s.lead_time_days, s.notes, s.is_active,
	coalesce((select count(*) from purchase_orders po where po.supplier_id = s.id and po.status <> 'cancelled'), 0)::int,
	coalesce((select sum(po.total_cost) from purchase_orders po where po.supplier_id = s.id and po.status <> 'cancelled'), 0)::bigint,
	s.created_at, s.updated_at`

func scanSupplier(row pgx.Row) (models.Supplier, error) {
	var s models.Supplier
	err := row.Scan(&s.ID, &s.Name, &s.ContactPerson, &s.Email, &s.Phone, &s.Address, &s.City, &s.Country,
		&s.PaymentTerms, &s.BankDetails, &s.LeadTimeDays, &s.Notes, &s.IsActive,
		&s.POCount, &s.TotalSpent, &s.CreatedAt, &s.UpdatedAt)
	return s, err
}

func normalizeSupplier(in *models.SupplierInput) error {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return invalid("supplier name is required")
	}
	in.ContactPerson = strings.TrimSpace(in.ContactPerson)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.Phone = strings.TrimSpace(in.Phone)
	in.Address = strings.TrimSpace(in.Address)
	in.City = strings.TrimSpace(in.City)
	if in.Country == "" {
		in.Country = "Nigeria"
	}
	if in.PaymentTerms == "" {
		in.PaymentTerms = "immediate"
	}
	if in.LeadTimeDays < 0 {
		in.LeadTimeDays = 0
	}
	return nil
}

func (s *Store) ListSuppliers(ctx context.Context, f models.SupplierFilter) (models.SupplierPage, error) {
	f.Page, f.Limit = clampPage(f.Page, f.Limit, 20, 100)
	var where []string
	var args []any
	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}

	if f.IsActive != nil {
		where = append(where, fmt.Sprintf("s.is_active = %s", arg(*f.IsActive)))
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		ph := arg("%" + q + "%")
		where = append(where, fmt.Sprintf("(s.name ilike %[1]s or s.contact_person ilike %[1]s or s.email ilike %[1]s or s.phone ilike %[1]s)", ph))
	}

	clause := ""
	if len(where) > 0 {
		clause = "where " + strings.Join(where, " and ")
	}

	from := "from suppliers s " + clause
	var total int
	if err := s.db.QueryRow(ctx, "select count(*) "+from, args...).Scan(&total); err != nil {
		return models.SupplierPage{}, err
	}

	limitPh, offsetPh := arg(f.Limit), arg((f.Page-1)*f.Limit)
	rows, err := s.db.Query(ctx, fmt.Sprintf("select %s %s order by s.name asc limit %s offset %s",
		supplierColumns, from, limitPh, offsetPh), args...)
	if err != nil {
		return models.SupplierPage{}, err
	}
	defer rows.Close()

	items := []models.Supplier{}
	for rows.Next() {
		sup, err := scanSupplier(rows)
		if err != nil {
			return models.SupplierPage{}, err
		}
		items = append(items, sup)
	}
	return models.SupplierPage{Items: items, Total: total, Page: f.Page, Limit: f.Limit}, rows.Err()
}

func (s *Store) GetSupplier(ctx context.Context, id string) (models.Supplier, error) {
	sup, err := scanSupplier(s.db.QueryRow(ctx, "select "+supplierColumns+" from suppliers s where s.id::text=$1", id))
	return sup, mapErr(err)
}

func (s *Store) CreateSupplier(ctx context.Context, in models.SupplierInput) (models.Supplier, error) {
	if err := normalizeSupplier(&in); err != nil {
		return models.Supplier{}, err
	}
	var id string
	err := s.db.QueryRow(ctx, `
		insert into suppliers (name, contact_person, email, phone, address, city, country, payment_terms, bank_details, lead_time_days, notes, is_active)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		returning id::text`,
		in.Name, in.ContactPerson, in.Email, in.Phone, in.Address, in.City, in.Country, in.PaymentTerms, in.BankDetails, in.LeadTimeDays, in.Notes, in.IsActive).Scan(&id)
	if err != nil {
		return models.Supplier{}, mapErr(err)
	}
	return s.GetSupplier(ctx, id)
}

func (s *Store) UpdateSupplier(ctx context.Context, id string, in models.SupplierInput) (models.Supplier, error) {
	if err := normalizeSupplier(&in); err != nil {
		return models.Supplier{}, err
	}
	tag, err := s.db.Exec(ctx, `
		update suppliers set name=$2, contact_person=$3, email=$4, phone=$5, address=$6, city=$7, country=$8,
			payment_terms=$9, bank_details=$10, lead_time_days=$11, notes=$12, is_active=$13, updated_at=now()
		where id::text=$1`,
		id, in.Name, in.ContactPerson, in.Email, in.Phone, in.Address, in.City, in.Country, in.PaymentTerms, in.BankDetails, in.LeadTimeDays, in.Notes, in.IsActive)
	if err != nil {
		return models.Supplier{}, mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return models.Supplier{}, ErrNotFound
	}
	return s.GetSupplier(ctx, id)
}

func (s *Store) DeleteSupplier(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, "delete from suppliers where id::text=$1", id)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ---------- Purchase Orders ----------

const poColumns = `po.id::text, po.po_number, po.supplier_id::text, coalesce(s.name, ''), po.status, po.payment_status,
	po.subtotal, po.shipping_cost, po.customs_duty, po.other_costs, po.tax_amount, po.total_cost, po.amount_paid,
	coalesce(to_char(po.order_date, 'YYYY-MM-DD'), ''),
	coalesce(to_char(po.expected_delivery_date, 'YYYY-MM-DD'), ''),
	po.received_at, po.tracking_number, po.shipping_carrier,
	po.created_by::text, po.created_by_name, po.notes, po.created_at, po.updated_at`

func scanPurchaseOrder(row pgx.Row) (models.PurchaseOrder, error) {
	var po models.PurchaseOrder
	var createdBy *string
	err := row.Scan(&po.ID, &po.PONumber, &po.SupplierID, &po.SupplierName, &po.Status, &po.PaymentStatus,
		&po.Subtotal, &po.ShippingCost, &po.CustomsDuty, &po.OtherCosts, &po.TaxAmount, &po.TotalCost, &po.AmountPaid,
		&po.OrderDate, &po.ExpectedDeliveryDate, &po.ReceivedAt, &po.TrackingNumber, &po.ShippingCarrier,
		&createdBy, &po.CreatedByName, &po.Notes, &po.CreatedAt, &po.UpdatedAt)
	po.CreatedBy = createdBy
	po.Items = []models.PurchaseOrderItem{}
	po.Payments = []models.ProcurementPayment{}
	return po, err
}

func normalizePO(in *models.PurchaseOrderInput) error {
	in.SupplierID = strings.TrimSpace(in.SupplierID)
	if in.SupplierID == "" {
		return invalid("supplier is required")
	}
	if len(in.Items) == 0 {
		return invalid("at least one item is required")
	}
	if len(in.Items) > 200 {
		return invalid("too many items (200 max)")
	}
	if in.ShippingCost < 0 || in.CustomsDuty < 0 || in.OtherCosts < 0 || in.TaxAmount < 0 {
		return invalid("costs cannot be negative")
	}
	for i := range in.Items {
		item := &in.Items[i]
		item.ProductName = strings.TrimSpace(item.ProductName)
		if item.ProductName == "" {
			return invalid(fmt.Sprintf("item %d requires a name", i+1))
		}
		if item.QuantityOrdered <= 0 {
			return invalid(fmt.Sprintf("item %d quantity must be greater than zero", i+1))
		}
		if item.UnitCost < 0 {
			return invalid(fmt.Sprintf("item %d unit cost cannot be negative", i+1))
		}
	}
	return nil
}

func (s *Store) ListPurchaseOrders(ctx context.Context, f models.PurchaseOrderFilter) (models.PurchaseOrderPage, error) {
	f.Page, f.Limit = clampPage(f.Page, f.Limit, 20, 100)
	var where []string
	var args []any
	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}

	if f.SupplierID != "" {
		where = append(where, fmt.Sprintf("po.supplier_id::text = %s", arg(f.SupplierID)))
	}
	if f.Status != "" {
		where = append(where, fmt.Sprintf("po.status = %s", arg(f.Status)))
	}
	if f.PaymentStatus != "" {
		where = append(where, fmt.Sprintf("po.payment_status = %s", arg(f.PaymentStatus)))
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		ph := arg("%" + q + "%")
		where = append(where, fmt.Sprintf("(po.po_number ilike %[1]s or s.name ilike %[1]s or po.notes ilike %[1]s or po.tracking_number ilike %[1]s)", ph))
	}

	clause := ""
	if len(where) > 0 {
		clause = "where " + strings.Join(where, " and ")
	}

	from := "from purchase_orders po left join suppliers s on s.id = po.supplier_id " + clause
	var total int
	if err := s.db.QueryRow(ctx, "select count(*) "+from, args...).Scan(&total); err != nil {
		return models.PurchaseOrderPage{}, err
	}

	limitPh, offsetPh := arg(f.Limit), arg((f.Page-1)*f.Limit)
	rows, err := s.db.Query(ctx, fmt.Sprintf("select %s %s order by po.created_at desc limit %s offset %s",
		poColumns, from, limitPh, offsetPh), args...)
	if err != nil {
		return models.PurchaseOrderPage{}, err
	}
	defer rows.Close()

	items := []models.PurchaseOrder{}
	for rows.Next() {
		po, err := scanPurchaseOrder(rows)
		if err != nil {
			return models.PurchaseOrderPage{}, err
		}
		items = append(items, po)
	}

	if len(items) > 0 {
		poIDs := make([]string, len(items))
		idMap := make(map[string]int, len(items))
		for i, p := range items {
			poIDs[i] = p.ID
			idMap[p.ID] = i
		}
		itemRows, err := s.db.Query(ctx, `
			select id::text, purchase_order_id::text, product_id::text, product_name, sku, quantity_ordered, quantity_received, unit_cost, total_cost
			from purchase_order_items where purchase_order_id::text = any($1) order by id asc`, poIDs)
		if err == nil {
			defer itemRows.Close()
			for itemRows.Next() {
				var it models.PurchaseOrderItem
				var pid *string
				if err := itemRows.Scan(&it.ID, &it.PurchaseOrderID, &pid, &it.ProductName, &it.SKU, &it.QuantityOrdered, &it.QuantityReceived, &it.UnitCost, &it.TotalCost); err == nil {
					it.ProductID = pid
					if idx, ok := idMap[it.PurchaseOrderID]; ok {
						items[idx].Items = append(items[idx].Items, it)
					}
				}
			}
		}
	}

	return models.PurchaseOrderPage{Items: items, Total: total, Page: f.Page, Limit: f.Limit}, rows.Err()
}

func (s *Store) GetPurchaseOrder(ctx context.Context, id string) (models.PurchaseOrder, error) {
	po, err := scanPurchaseOrder(s.db.QueryRow(ctx, `
		select `+poColumns+`
		from purchase_orders po
		left join suppliers s on s.id = po.supplier_id
		where po.id::text=$1 or po.po_number=$1`, id))
	if err != nil {
		return models.PurchaseOrder{}, mapErr(err)
	}

	// Fetch items
	rows, err := s.db.Query(ctx, `
		select id::text, purchase_order_id::text, product_id::text, product_name, sku, quantity_ordered, quantity_received, unit_cost, total_cost
		from purchase_order_items where purchase_order_id::text=$1 order by id asc`, po.ID)
	if err != nil {
		return models.PurchaseOrder{}, err
	}
	defer rows.Close()

	po.Items = []models.PurchaseOrderItem{}
	for rows.Next() {
		var it models.PurchaseOrderItem
		var pid *string
		if err := rows.Scan(&it.ID, &it.PurchaseOrderID, &pid, &it.ProductName, &it.SKU, &it.QuantityOrdered, &it.QuantityReceived, &it.UnitCost, &it.TotalCost); err != nil {
			return models.PurchaseOrder{}, err
		}
		it.ProductID = pid
		po.Items = append(po.Items, it)
	}
	if err := rows.Err(); err != nil {
		return models.PurchaseOrder{}, err
	}

	// Fetch payments
	pRows, err := s.db.Query(ctx, `
		select id::text, purchase_order_id::text, amount, payment_method, reference, paid_at, created_by_name, notes
		from procurement_payments where purchase_order_id::text=$1 order by paid_at desc`, po.ID)
	if err != nil {
		return models.PurchaseOrder{}, err
	}
	defer pRows.Close()

	po.Payments = []models.ProcurementPayment{}
	for pRows.Next() {
		var pay models.ProcurementPayment
		if err := pRows.Scan(&pay.ID, &pay.PurchaseOrderID, &pay.Amount, &pay.PaymentMethod, &pay.Reference, &pay.PaidAt, &pay.CreatedByName, &pay.Notes); err != nil {
			return models.PurchaseOrder{}, err
		}
		po.Payments = append(po.Payments, pay)
	}

	return po, pRows.Err()
}

func (s *Store) CreatePurchaseOrder(ctx context.Context, in models.PurchaseOrderInput, creatorID *string, creatorName string) (models.PurchaseOrder, error) {
	if err := normalizePO(&in); err != nil {
		return models.PurchaseOrder{}, err
	}

	var poID string
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var seq int64
		if err := tx.QueryRow(ctx, "select nextval('purchase_order_number_seq')").Scan(&seq); err != nil {
			return err
		}
		poNumber := fmt.Sprintf("PO-%05d", seq)

		var subtotal int64
		for _, it := range in.Items {
			subtotal += int64(it.QuantityOrdered) * it.UnitCost
		}
		totalCost := subtotal + in.ShippingCost + in.CustomsDuty + in.OtherCosts + in.TaxAmount

		var orderDateVal, expDeliveryDateVal *string
		if in.OrderDate != "" {
			orderDateVal = &in.OrderDate
		}
		if in.ExpectedDeliveryDate != "" {
			expDeliveryDateVal = &in.ExpectedDeliveryDate
		}

		status := "draft"
		if in.OrderDate != "" {
			status = "ordered"
		}

		err := tx.QueryRow(ctx, `
			insert into purchase_orders (po_number, supplier_id, status, payment_status, subtotal, shipping_cost, customs_duty,
				other_costs, tax_amount, total_cost, amount_paid, order_date, expected_delivery_date, tracking_number,
				shipping_carrier, created_by, created_by_name, notes)
			values ($1,$2::uuid,$3,'unpaid',$4,$5,$6,$7,$8,$9,0,$10,$11,$12,$13,$14::uuid,$15,$16)
			returning id::text`,
			poNumber, in.SupplierID, status, subtotal, in.ShippingCost, in.CustomsDuty,
			in.OtherCosts, in.TaxAmount, totalCost, orderDateVal, expDeliveryDateVal,
			in.TrackingNumber, in.ShippingCarrier, creatorID, creatorName, in.Notes).Scan(&poID)
		if err != nil {
			return err
		}

		for _, it := range in.Items {
			totalItemCost := int64(it.QuantityOrdered) * it.UnitCost
			var pidVal *string
			if it.ProductID != nil && *it.ProductID != "" {
				pidVal = it.ProductID
			}
			_, err = tx.Exec(ctx, `
				insert into purchase_order_items (purchase_order_id, product_id, product_name, sku, quantity_ordered, quantity_received, unit_cost, total_cost)
				values ($1::uuid,$2::uuid,$3,$4,$5,0,$6,$7)`,
				poID, pidVal, it.ProductName, it.SKU, it.QuantityOrdered, it.UnitCost, totalItemCost)
			if err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return models.PurchaseOrder{}, mapErr(err)
	}
	return s.GetPurchaseOrder(ctx, poID)
}

func (s *Store) UpdatePurchaseOrder(ctx context.Context, id string, in models.PurchaseOrderInput) (models.PurchaseOrder, error) {
	if err := normalizePO(&in); err != nil {
		return models.PurchaseOrder{}, err
	}

	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var currentStatus string
		var amountPaid int64
		if err := tx.QueryRow(ctx, "select status, amount_paid from purchase_orders where id::text=$1 for update", id).Scan(&currentStatus, &amountPaid); err != nil {
			return err
		}
		if currentStatus == "received" || currentStatus == "cancelled" {
			return invalid("cannot edit a received or cancelled purchase order")
		}

		var subtotal int64
		for _, it := range in.Items {
			subtotal += int64(it.QuantityOrdered) * it.UnitCost
		}
		totalCost := subtotal + in.ShippingCost + in.CustomsDuty + in.OtherCosts + in.TaxAmount

		var orderDateVal, expDeliveryDateVal *string
		if in.OrderDate != "" {
			orderDateVal = &in.OrderDate
		}
		if in.ExpectedDeliveryDate != "" {
			expDeliveryDateVal = &in.ExpectedDeliveryDate
		}

		paymentStatus := "unpaid"
		if amountPaid >= totalCost && totalCost > 0 {
			paymentStatus = "paid"
		} else if amountPaid > 0 {
			paymentStatus = "partially_paid"
		}

		_, err := tx.Exec(ctx, `
			update purchase_orders set supplier_id=$2::uuid, subtotal=$3, shipping_cost=$4, customs_duty=$5,
				other_costs=$6, tax_amount=$7, total_cost=$8, payment_status=$9, order_date=$10,
				expected_delivery_date=$11, tracking_number=$12, shipping_carrier=$13, notes=$14, updated_at=now()
			where id::text=$1`,
			id, in.SupplierID, subtotal, in.ShippingCost, in.CustomsDuty,
			in.OtherCosts, in.TaxAmount, totalCost, paymentStatus, orderDateVal, expDeliveryDateVal,
			in.TrackingNumber, in.ShippingCarrier, in.Notes)
		if err != nil {
			return err
		}

		// Check if any items have already been received
		var receivedCount int
		if err := tx.QueryRow(ctx, "select coalesce(sum(quantity_received), 0) from purchase_order_items where purchase_order_id::text=$1", id).Scan(&receivedCount); err != nil {
			return err
		}
		if receivedCount > 0 {
			return invalid("items have already been received for this purchase order; delete/recreate items is prohibited")
		}

		// Replace items
		if _, err := tx.Exec(ctx, "delete from purchase_order_items where purchase_order_id::text=$1", id); err != nil {
			return err
		}
		for _, it := range in.Items {
			totalItemCost := int64(it.QuantityOrdered) * it.UnitCost
			var pidVal *string
			if it.ProductID != nil && *it.ProductID != "" {
				pidVal = it.ProductID
			}
			_, err = tx.Exec(ctx, `
				insert into purchase_order_items (purchase_order_id, product_id, product_name, sku, quantity_ordered, quantity_received, unit_cost, total_cost)
				values ($1::uuid,$2::uuid,$3,$4,$5,0,$6,$7)`,
				id, pidVal, it.ProductName, it.SKU, it.QuantityOrdered, it.UnitCost, totalItemCost)
			if err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return models.PurchaseOrder{}, mapErr(err)
	}
	return s.GetPurchaseOrder(ctx, id)
}

func (s *Store) SetPurchaseOrderStatus(ctx context.Context, id string, status string) (models.PurchaseOrder, error) {
	status = strings.ToLower(strings.TrimSpace(status))
	validStatuses := map[string]bool{
		"draft":              true,
		"ordered":            true,
		"partially_received": true,
		"received":           true,
		"cancelled":          true,
	}
	if !validStatuses[status] {
		return models.PurchaseOrder{}, invalid("invalid status: " + status)
	}

	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var currentStatus string
		var receivedCount int
		if err := tx.QueryRow(ctx, `
			select po.status, coalesce(sum(poi.quantity_received), 0)
			from purchase_orders po
			left join purchase_order_items poi on poi.purchase_order_id = po.id
			where po.id::text=$1
			group by po.id`, id).Scan(&currentStatus, &receivedCount); err != nil {
			return err
		}

		if status == "cancelled" && receivedCount > 0 {
			return invalid("cannot cancel a purchase order with received goods")
		}

		var receivedAt *time.Time
		if status == "received" {
			now := time.Now()
			receivedAt = &now
		}

		tag, err := tx.Exec(ctx, `
			update purchase_orders set status=$2, received_at=coalesce($3, received_at), updated_at=now()
			where id::text=$1`, id, status, receivedAt)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		return nil
	})
	if err != nil {
		return models.PurchaseOrder{}, mapErr(err)
	}
	return s.GetPurchaseOrder(ctx, id)
}

func (s *Store) DeletePurchaseOrder(ctx context.Context, id string) error {
	var currentStatus string
	var receivedCount int
	var amountPaid int64
	err := s.db.QueryRow(ctx, `
		select po.status, po.amount_paid, coalesce(sum(poi.quantity_received), 0)
		from purchase_orders po
		left join purchase_order_items poi on poi.purchase_order_id = po.id
		where po.id::text=$1
		group by po.id`, id).Scan(&currentStatus, &amountPaid, &receivedCount)
	if err != nil {
		return mapErr(err)
	}
	if receivedCount > 0 || currentStatus == "partially_received" || currentStatus == "received" {
		return invalid("cannot delete a purchase order that has already received goods into inventory")
	}
	if amountPaid > 0 {
		return invalid("cannot delete a purchase order with recorded payments; void or remove payments first")
	}

	tag, err := s.db.Exec(ctx, "delete from purchase_orders where id::text=$1", id)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ---------- Goods Receipt & Inventory Synchronization ----------

func (s *Store) ReceiveGoods(ctx context.Context, poID string, in models.ReceiveGoodsInput, actor string) (models.PurchaseOrder, error) {
	if len(in.Items) == 0 {
		return models.PurchaseOrder{}, invalid("at least one item receipt is required")
	}

	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var poNumber, status string
		if err := tx.QueryRow(ctx, "select po_number, status from purchase_orders where id::text=$1 for update", poID).Scan(&poNumber, &status); err != nil {
			return err
		}
		if status == "cancelled" {
			return invalid("cannot receive goods for a cancelled purchase order")
		}

		for _, itemIn := range in.Items {
			if itemIn.QuantityReceived <= 0 {
				continue
			}

			var (
				itemID           string
				pid              *string
				qtyOrdered       int
				currReceived     int
				unitCost         int64
				prodName         string
			)
			err := tx.QueryRow(ctx, `
				select id::text, product_id::text, quantity_ordered, quantity_received, unit_cost, product_name
				from purchase_order_items where id::text=$1 and purchase_order_id::text=$2 for update`,
				itemIn.ItemID, poID).Scan(&itemID, &pid, &qtyOrdered, &currReceived, &unitCost, &prodName)
			if err != nil {
				return fmt.Errorf("item %s: %w", itemIn.ItemID, mapErr(err))
			}

			if currReceived+itemIn.QuantityReceived > qtyOrdered {
				return invalid(fmt.Sprintf("cannot receive %d units for '%s': ordered %d, already received %d",
					itemIn.QuantityReceived, prodName, qtyOrdered, currReceived))
			}

			// Update quantity_received on the PO item
			_, err = tx.Exec(ctx, `
				update purchase_order_items set quantity_received = quantity_received + $1 where id::text=$2`,
				itemIn.QuantityReceived, itemID)
			if err != nil {
				return err
			}

			// If linked to a product, increase stock and add movement log
			if pid != nil && *pid != "" {
				_, err = tx.Exec(ctx, `
					update products set stock = stock + $1, updated_at = now() where id::text=$2`,
					itemIn.QuantityReceived, *pid)
				if err != nil {
					return err
				}

				if in.UpdateCostPrice && unitCost > 0 {
					_, err = tx.Exec(ctx, `
						update products set cost_price = $1, updated_at = now() where id::text=$2`,
						unitCost, *pid)
					if err != nil {
						return err
					}
				}

				reason := fmt.Sprintf("Procurement %s received", poNumber)
				if strings.TrimSpace(in.Notes) != "" {
					reason += ": " + strings.TrimSpace(in.Notes)
				}
				_, err = tx.Exec(ctx, `
					insert into inventory_movements (product_id, change, reason, actor, purchase_order_id)
					values ($1::uuid, $2, $3, $4, $5::uuid)`,
					*pid, itemIn.QuantityReceived, reason, actor, poID)
				if err != nil {
					return err
				}
			}
		}

		// Recompute overall PO status
		var totalOrdered, totalReceived int
		if err := tx.QueryRow(ctx, `
			select coalesce(sum(quantity_ordered), 0), coalesce(sum(quantity_received), 0)
			from purchase_order_items where purchase_order_id::text=$1`, poID).Scan(&totalOrdered, &totalReceived); err != nil {
			return err
		}

		newStatus := "partially_received"
		var receivedAt *time.Time
		if totalReceived >= totalOrdered && totalOrdered > 0 {
			newStatus = "received"
			now := time.Now()
			receivedAt = &now
		}

		_, err := tx.Exec(ctx, `
			update purchase_orders set status=$2, received_at=coalesce($3, received_at), updated_at=now()
			where id::text=$1`, poID, newStatus, receivedAt)
		return err
	})
	if err != nil {
		return models.PurchaseOrder{}, mapErr(err)
	}
	return s.GetPurchaseOrder(ctx, poID)
}

// ---------- Supplier Payments ----------

func (s *Store) RecordProcurementPayment(ctx context.Context, poID string, in models.ProcurementPaymentInput, creatorName string) (models.PurchaseOrder, error) {
	if in.Amount <= 0 {
		return models.PurchaseOrder{}, invalid("payment amount must be greater than zero")
	}
	in.PaymentMethod = strings.ToLower(strings.TrimSpace(in.PaymentMethod))
	if in.PaymentMethod == "" {
		in.PaymentMethod = "bank_transfer"
	}
	in.Reference = strings.TrimSpace(in.Reference)
	in.Notes = strings.TrimSpace(in.Notes)

	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var totalCost, currPaid int64
		if err := tx.QueryRow(ctx, "select total_cost, amount_paid from purchase_orders where id::text=$1 for update", poID).Scan(&totalCost, &currPaid); err != nil {
			return err
		}

		_, err := tx.Exec(ctx, `
			insert into procurement_payments (purchase_order_id, amount, payment_method, reference, paid_at, created_by_name, notes)
			values ($1::uuid,$2,$3,$4,now(),$5,$6)`,
			poID, in.Amount, in.PaymentMethod, in.Reference, creatorName, in.Notes)
		if err != nil {
			return err
		}

		newPaid := currPaid + in.Amount
		paymentStatus := "partially_paid"
		if newPaid >= totalCost && totalCost > 0 {
			paymentStatus = "paid"
		}

		_, err = tx.Exec(ctx, `
			update purchase_orders set amount_paid=$2, payment_status=$3, updated_at=now() where id::text=$1`,
			poID, newPaid, paymentStatus)
		return err
	})
	if err != nil {
		return models.PurchaseOrder{}, mapErr(err)
	}
	return s.GetPurchaseOrder(ctx, poID)
}

// ---------- Procurement Stats ----------

func (s *Store) ProcurementStats(ctx context.Context) (models.ProcurementStats, error) {
	var st models.ProcurementStats

	err := s.db.QueryRow(ctx, `
		select
			coalesce(sum(total_cost) filter (where status <> 'cancelled'), 0),
			count(*) filter (where status in ('draft', 'ordered', 'partially_received')),
			coalesce(sum(total_cost - amount_paid) filter (where status <> 'cancelled' and payment_status <> 'paid'), 0)
		from purchase_orders`).Scan(&st.TotalSpend, &st.PendingPOsCount, &st.UnpaidSupplierAmount)
	if err != nil {
		return st, err
	}

	err = s.db.QueryRow(ctx, `
		select coalesce(sum(amount) filter (where paid_at >= date_trunc('month', now())), 0)
		from procurement_payments`).Scan(&st.SpendThisMonth)
	if err != nil {
		return st, err
	}

	err = s.db.QueryRow(ctx, `
		select count(*) from suppliers where is_active`).Scan(&st.ActiveSuppliersCount)
	if err != nil {
		return st, err
	}

	err = s.db.QueryRow(ctx, `
		select
			coalesce(sum(cost_price::numeric * stock), 0)::bigint,
			coalesce(sum(price::numeric * stock), 0)::bigint
		from products where is_active`).Scan(&st.TotalInventoryCost, &st.TotalInventoryRetail)
	if err != nil {
		return st, err
	}

	return st, nil
}
