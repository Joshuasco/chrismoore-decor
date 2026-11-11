-- Chris Moore Interior Decor — core schema (PostgreSQL / Supabase)
-- All money columns are stored in kobo (1 NGN = 100 kobo).

create extension if not exists "pgcrypto";

create table if not exists categories (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    slug        text not null unique,
    description text not null default '',
    image_url   text not null default '',
    sort_order  int  not null default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create table if not exists products (
    id                  uuid primary key default gen_random_uuid(),
    category_id         uuid references categories(id) on delete set null,
    name                text not null,
    slug                text not null unique,
    sku                 text not null unique,
    short_description   text not null default '',
    description         text not null default '',
    price               bigint not null check (price >= 0),
    compare_at_price    bigint check (compare_at_price is null or compare_at_price >= 0),
    stock               int not null default 0 check (stock >= 0),
    low_stock_threshold int not null default 5,
    images              text[] not null default '{}',
    colors              text[] not null default '{}',
    sizes               text[] not null default '{}',
    material            text not null default '',
    badge               text not null default '',
    is_featured         boolean not null default false,
    is_active           boolean not null default true,
    rating              numeric(2,1) not null default 0,
    review_count        int not null default 0,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);
create index if not exists products_category_idx on products(category_id);
create index if not exists products_active_idx on products(is_active);
create index if not exists products_search_idx on products using gin (to_tsvector('english', name || ' ' || description));

create table if not exists orders (
    id               uuid primary key default gen_random_uuid(),
    reference        text not null unique,
    customer_name    text not null,
    email            text not null,
    phone            text not null,
    address          text not null,
    city             text not null default '',
    state            text not null default '',
    notes            text not null default '',
    subtotal         bigint not null,
    shipping_fee     bigint not null default 0,
    total            bigint not null,
    channel          text not null check (channel in ('whatsapp','paystack','flutterwave')),
    status           text not null default 'pending'
                     check (status in ('pending','confirmed','processing','shipped','delivered','cancelled')),
    payment_status   text not null default 'unpaid'
                     check (payment_status in ('unpaid','paid','failed','refunded')),
    payment_provider text not null default '',
    paid_at          timestamptz,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);
create index if not exists orders_created_idx on orders(created_at desc);
create index if not exists orders_status_idx on orders(status);

create table if not exists order_items (
    id           uuid primary key default gen_random_uuid(),
    order_id     uuid not null references orders(id) on delete cascade,
    product_id   uuid references products(id) on delete set null,
    product_name text not null,
    sku          text not null default '',
    image_url    text not null default '',
    unit_price   bigint not null,
    quantity     int not null check (quantity > 0),
    color        text not null default '',
    size         text not null default ''
);
create index if not exists order_items_order_idx on order_items(order_id);

create table if not exists payments (
    id         uuid primary key default gen_random_uuid(),
    order_id   uuid not null references orders(id) on delete cascade,
    provider   text not null check (provider in ('paystack','flutterwave')),
    reference  text not null unique,
    amount     bigint not null,
    status     text not null default 'initialized'
               check (status in ('initialized','success','failed','abandoned')),
    raw        jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists payments_order_idx on payments(order_id);

create table if not exists inventory_movements (
    id         uuid primary key default gen_random_uuid(),
    product_id uuid not null references products(id) on delete cascade,
    change     int not null,
    reason     text not null,
    order_id   uuid references orders(id) on delete set null,
    actor      text not null default 'system',
    created_at timestamptz not null default now()
);
create index if not exists inventory_movements_product_idx on inventory_movements(product_id, created_at desc);

create table if not exists admin_users (
    id            uuid primary key default gen_random_uuid(),
    email         text not null unique,
    name          text not null default '',
    password_hash text not null,
    role          text not null default 'admin' check (role in ('admin','staff')),
    created_at    timestamptz not null default now()
);

create table if not exists store_settings (
    key        text primary key,
    value      text not null,
    updated_at timestamptz not null default now()
);

create table if not exists newsletter_subscribers (
    email      text primary key,
    created_at timestamptz not null default now()
);

create table if not exists schema_migrations (
    version    text primary key,
    applied_at timestamptz not null default now()
);

insert into store_settings(key, value) values
    ('store_name', 'Chris Moore Interior Decor'),
    ('whatsapp_number', '2348000000000'),
    ('contact_email', 'hello@chrismooredecor.com'),
    ('contact_phone', '+234 800 000 0000'),
    ('address', 'Lagos, Nigeria'),
    ('shipping_fee', '500000'),
    ('free_shipping_threshold', '30000000'),
    ('announcement', 'Free delivery within Lagos on orders above ₦300,000')
on conflict (key) do nothing;

-- Supabase: the API connects with the service connection string, so lock the
-- tables away from the anon/authenticated PostgREST roles.
do $$
declare t text;
begin
  foreach t in array array['categories','products','orders','order_items','payments',
                           'inventory_movements','admin_users','store_settings',
                           'newsletter_subscribers','schema_migrations']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
