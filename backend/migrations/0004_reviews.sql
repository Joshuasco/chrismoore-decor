-- Customer product reviews. Only approved reviews are public, and a product's
-- rating / review_count are always derived from them (kept in sync by trigger),
-- so the stars on product cards match the reviews on the detail page.
create table if not exists product_reviews (
    id         uuid primary key default gen_random_uuid(),
    product_id uuid not null references products(id) on delete cascade,
    name       text not null,
    email      text not null default '',          -- private; never returned publicly
    rating     int  not null check (rating between 1 and 5),
    title      text not null default '',
    body       text not null,
    status     text not null default 'pending' check (status in ('pending','approved','rejected')),
    verified   boolean not null default false,     -- reviewer has a paid/delivered order for this product
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists product_reviews_product_idx on product_reviews(product_id, status, created_at desc);
create index if not exists product_reviews_status_idx on product_reviews(status, created_at desc);
-- One review per customer per product.
create unique index if not exists product_reviews_one_per_email
    on product_reviews(product_id, lower(email)) where email <> '';

alter table product_reviews enable row level security;

create or replace function refresh_product_rating(pid uuid) returns void language sql as $$
    update products p set
        rating = coalesce((select round(avg(r.rating)::numeric, 1) from product_reviews r
                           where r.product_id = pid and r.status = 'approved'), 0),
        review_count = (select count(*) from product_reviews r
                        where r.product_id = pid and r.status = 'approved')
    where p.id = pid;
$$;

create or replace function product_reviews_changed() returns trigger language plpgsql as $$
begin
    if tg_op in ('INSERT', 'UPDATE') then
        perform refresh_product_rating(new.product_id);
    end if;
    if tg_op in ('UPDATE', 'DELETE') and (tg_op = 'DELETE' or old.product_id <> new.product_id) then
        perform refresh_product_rating(old.product_id);
    end if;
    return null;
end;
$$;

drop trigger if exists product_reviews_refresh on product_reviews;
create trigger product_reviews_refresh
    after insert or update or delete on product_reviews
    for each row execute function product_reviews_changed();

-- Make existing products tally with their (approved) reviews from now on.
update products p set
    rating = coalesce((select round(avg(r.rating)::numeric, 1) from product_reviews r where r.product_id = p.id and r.status = 'approved'), 0),
    review_count = (select count(*) from product_reviews r where r.product_id = p.id and r.status = 'approved');
