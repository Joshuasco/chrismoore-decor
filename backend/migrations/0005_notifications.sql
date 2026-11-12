-- Customer notifications (email, SMS, WhatsApp) sent for each order event.
-- One row per order + event + channel, so the same update is never sent twice
-- (e.g. when the payment callback and the webhook arrive together). The admin
-- order page lists them, and a manual resend reuses the same row.
create table if not exists order_notifications (
    id         uuid primary key default gen_random_uuid(),
    order_id   uuid not null references orders(id) on delete cascade,
    event      text not null,                    -- placed, paid, confirmed, shipped, delivered, cancelled
    channel    text not null check (channel in ('email','sms','whatsapp')),
    recipient  text not null default '',
    status     text not null default 'sending' check (status in ('sending','sent','failed')),
    error      text not null default '',
    attempts   int  not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (order_id, event, channel)
);
create index if not exists order_notifications_order_idx on order_notifications(order_id, created_at);

alter table order_notifications enable row level security;
