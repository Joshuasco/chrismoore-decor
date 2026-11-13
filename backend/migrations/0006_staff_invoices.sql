-- Role-based access for the admin dashboard, and customer invoices.

-- ---------- Staff groups and account approval ----------
-- A group is a named set of dashboard services (permissions). Each staff
-- member belongs to at most one group. Admins can access everything.
create table if not exists staff_groups (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    description text not null default '',
    permissions text[] not null default '{}',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create unique index if not exists staff_groups_name_idx on staff_groups(lower(name));

-- Existing accounts keep working: they are approved admins.
alter table admin_users
    add column if not exists status text not null default 'approved'
        check (status in ('pending','approved','disapproved')),
    add column if not exists group_id uuid references staff_groups(id) on delete set null,
    add column if not exists status_changed_at timestamptz,
    add column if not exists last_login_at timestamptz;
-- New sign-ups are staff awaiting approval.
alter table admin_users alter column status set default 'pending';
alter table admin_users alter column role set default 'staff';
create index if not exists admin_users_status_idx on admin_users(status, created_at desc);

-- ---------- Invoices ----------
create sequence if not exists invoice_number_seq;

create table if not exists invoices (
    id               uuid primary key default gen_random_uuid(),
    number           text not null unique,              -- INV-00001, shown to customers
    token            text not null unique,              -- secret used in the public payment link
    customer_name    text not null,
    email            text not null default '',
    phone            text not null default '',
    address          text not null default '',
    notes            text not null default '',
    subtotal         bigint not null default 0,         -- kobo
    discount         bigint not null default 0 check (discount >= 0),
    delivery_fee     bigint not null default 0 check (delivery_fee >= 0),
    tax_rate_bp      int    not null default 0 check (tax_rate_bp between 0 and 10000), -- 750 = 7.5%
    tax              bigint not null default 0,
    total            bigint not null default 0,
    status           text not null default 'unpaid' check (status in ('unpaid','paid','void')),
    due_date         date,
    payment_provider text not null default '',
    paid_at          timestamptz,
    created_by       uuid references admin_users(id) on delete set null,
    created_by_name  text not null default '',
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);
create index if not exists invoices_status_idx on invoices(status, created_at desc);

create table if not exists invoice_items (
    id          uuid primary key default gen_random_uuid(),
    invoice_id  uuid not null references invoices(id) on delete cascade,
    product_id  uuid references products(id) on delete set null,
    description text not null,
    quantity    int not null check (quantity > 0),
    unit_price  bigint not null check (unit_price >= 0),
    position    int not null default 0
);
create index if not exists invoice_items_invoice_idx on invoice_items(invoice_id, position);

-- A payment attempt now belongs to either an order or an invoice.
alter table payments alter column order_id drop not null;
alter table payments add column if not exists invoice_id uuid references invoices(id) on delete cascade;
alter table payments add constraint payments_one_target check (num_nonnulls(order_id, invoice_id) = 1);
create index if not exists payments_invoice_idx on payments(invoice_id);

alter table staff_groups  enable row level security;
alter table invoices      enable row level security;
alter table invoice_items enable row level security;
