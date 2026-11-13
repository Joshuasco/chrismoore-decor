-- Catalogue products on an invoice reserve stock while the invoice is
-- unpaid or paid (like website orders). Movements record which invoice
-- caused them.
alter table inventory_movements
    add column if not exists invoice_id uuid references invoices(id) on delete set null;
create index if not exists inventory_movements_invoice_idx on inventory_movements(invoice_id);

-- Invoices created before this migration never took stock, so voiding or
-- deleting them must not give any back. Only new invoices hold stock.
alter table invoices add column if not exists stock_reserved boolean not null default false;
