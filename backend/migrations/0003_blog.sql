-- Blog / journal posts. Content is Markdown, rendered safely on the storefront.
create table if not exists blog_posts (
    id               uuid primary key default gen_random_uuid(),
    title            text not null,
    slug             text not null unique,
    excerpt          text not null default '',
    content          text not null default '',
    cover_image      text not null default '',
    category         text not null default 'Inspiration',
    tags             text[] not null default '{}',
    author_name      text not null default 'Chris Moore Interior Decor',
    status           text not null default 'draft' check (status in ('draft','published')),
    is_featured      boolean not null default false,
    -- A published post goes live at published_at (allows scheduling).
    published_at     timestamptz,
    reading_minutes  int not null default 1,
    product_category text not null default '', -- category slug for "Shop the look"
    seo_title        text not null default '',
    seo_description  text not null default '',
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);
create index if not exists blog_posts_live_idx on blog_posts(status, published_at desc);
create index if not exists blog_posts_category_idx on blog_posts(lower(category));
create index if not exists blog_posts_tags_idx on blog_posts using gin(tags);

alter table blog_posts enable row level security;
