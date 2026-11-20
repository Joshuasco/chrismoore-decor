-- Chris Moore Interior Decor — Procurement & Cost Tracking Schema
-- All monetary amounts are stored in kobo (1 NGN = 100 kobo).

-- 1. Suppliers / Vendors master table
create table if not exists suppliers (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    contact_person  text not null default '',
    email           text not null default '',
    phone           text not null default '',
    address         text not null default '',
    city            text not null default '',
    country         text not null default 'Nigeria',
    payment_terms   text not null default 'immediate',
    bank_details    text not null default '',
    lead_time_days  int  not null default 7 check (lead_time_days >= 0),
    notes           text not null default '',
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create unique index if not exists suppliers_name_idx on suppliers(lower(name));
create index if not exists suppliers_active_idx on suppliers(is_active);

-- 2. Purchase Orders sequence and table
create sequence if not exists purchase_order_number_seq;

create table if not exists purchase_orders (
    id                     uuid primary key default gen_random_uuid(),
    po_number              text not null unique,
    supplier_id            uuid not null references suppliers(id) on delete restrict,
    status                 text not null default 'draft'
                           check (status in ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
    payment_status         text not null default 'unpaid'
                           check (payment_status in ('unpaid', 'partially_paid', 'paid')),
    -- Cost breakdown in kobo:
    subtotal               bigint not null default 0 check (subtotal >= 0),
    shipping_cost          bigint not null default 0 check (shipping_cost >= 0),
    customs_duty           bigint not null default 0 check (customs_duty >= 0),
    other_costs            bigint not null default 0 check (other_costs >= 0),
    tax_amount             bigint not null default 0 check (tax_amount >= 0),
    total_cost             bigint not null default 0 check (total_cost >= 0),
    amount_paid            bigint not null default 0 check (amount_paid >= 0),
    -- Dates:
    order_date             date,
    expected_delivery_date date,
    received_at            timestamptz,
    -- Logistics & Tracking:
    tracking_number        text not null default '',
    shipping_carrier       text not null default '',
    -- Audit & Notes:
    created_by             uuid references admin_users(id) on delete set null,
    created_by_name        text not null default '',
    notes                  text not null default '',
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now()
);
create index if not exists purchase_orders_supplier_idx on purchase_orders(supplier_id);
create index if not exists purchase_orders_status_idx on purchase_orders(status, created_at desc);
create index if not exists purchase_orders_payment_status_idx on purchase_orders(payment_status);

-- 3. Purchase Order Items
create table if not exists purchase_order_items (
    id                 uuid primary key default gen_random_uuid(),
    purchase_order_id  uuid not null references purchase_orders(id) on delete cascade,
    product_id         uuid references products(id) on delete set null,
    product_name       text not null,
    sku                text not null default '',
    quantity_ordered   int not null check (quantity_ordered > 0),
    quantity_received  int not null default 0 check (quantity_received >= 0 and quantity_received <= quantity_ordered),
    unit_cost          bigint not null check (unit_cost >= 0), -- kobo
    total_cost         bigint not null check (total_cost >= 0)  -- kobo (quantity_ordered * unit_cost)
);
create index if not exists po_items_po_idx on purchase_order_items(purchase_order_id);
create index if not exists po_items_product_idx on purchase_order_items(product_id);

-- 4. Procurement Payments to Suppliers
create table if not exists procurement_payments (
    id                uuid primary key default gen_random_uuid(),
    purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
    amount            bigint not null check (amount > 0), -- kobo
    payment_method    text not null default 'bank_transfer'
                      check (payment_method in ('bank_transfer', 'cash', 'wire', 'cheque', 'other')),
    reference         text not null default '',
    paid_at           timestamptz not null default now(),
    created_by_name   text not null default '',
    notes             text not null default ''
);
create index if not exists procurement_payments_po_idx on procurement_payments(purchase_order_id, paid_at desc);

-- 5. Alter products to track unit cost price (for margin analysis and landed cost)
alter table products
    add column if not exists cost_price bigint not null default 0 check (cost_price >= 0);

-- 6. Link inventory movements to purchase orders
alter table inventory_movements
    add column if not exists purchase_order_id uuid references purchase_orders(id) on delete set null;
create index if not exists inventory_movements_po_idx on inventory_movements(purchase_order_id);

-- 7. Row Level Security for Supabase
alter table suppliers enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table procurement_payments enable row level security;
