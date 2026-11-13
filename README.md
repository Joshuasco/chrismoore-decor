<<<<<<< HEAD
# Chris Moore Interior Decor

E-commerce platform for **Chris Moore Interior Decor**, which sells and supplies curtains & accessories, bed sheets, vertical blinds and rugs.

| Layer | Tech |
|---|---|
| Storefront + admin dashboard | Next.js 16 (App Router), Tailwind CSS v4, react-hot-toast, Zustand (cart) |
| API | Go (chi, pgx) |
| Database | PostgreSQL on **Supabase** |
| Cache / rate limiting | Redis |
| Ordering | WhatsApp click-to-chat (default) **or** online payment via **Paystack** / **Flutterwave** |

```
backend/    Go API — migrations, seed data, payments, WhatsApp, admin endpoints
frontend/   Next.js storefront (/), checkout, order tracking, admin dashboard (/admin)
docker-compose.yml   Redis + API + web for local/prod-like runs
```

## How ordering works

1. The shopper adds items to the cart and checks out with their delivery details.
2. The server **re-prices the cart from the database** and **reserves stock** atomically. Prices from the client are never trusted.
3. The shopper picks one of:
   - **WhatsApp** (default): an order is created and the shopper is taken to `/order/{ref}`, where one tap opens WhatsApp with a pre-filled message: items, totals, address and a link back to the order.
   - **Paystack / Flutterwave**: the shopper is redirected to hosted checkout and returns to `/payment/callback`. The API then **verifies the transaction with the provider** (amount + currency) before marking the order paid.
4. **WhatsApp orders can still be paid online.** The order page shows *Pay with Paystack / Flutterwave*, and in the dashboard the owner can *Message customer* or *Copy payment link* to send that link in the chat.
5. The customer is sent their order link by email, SMS and/or WhatsApp, plus updates as the order progresses (see *Customer order updates* below).
6. Webhooks (`/api/webhooks/paystack`, `/api/webhooks/flutterwave`) confirm payments even if the shopper closes the browser. Paystack webhooks are checked by HMAC signature and Flutterwave webhooks by secret hash.
7. Cancelling an order returns its stock. Unpaid **online** orders are auto-cancelled after 3 hours to release stock. WhatsApp orders are left for the owner to manage.

Every stock change (order placed, cancelled, restock, damage, manual edit) is written to an inventory log.

## Product reviews

- Each product page has a **Customer reviews** section:
  - average rating with a 5→1 star breakdown (click a bar to filter);
  - sorting (most recent, highest, lowest) and "Show more reviews";
  - a **Write a review** form (star picker, name, email kept private, title, review).
- New reviews are **pending** until approved in **Admin → Reviews**, where you can approve, reject or delete them. Pending ones are also counted on the dashboard.
- A review is marked **Verified buyer** when the reviewer's email has a paid or delivered order for that product. Each email can review a product once. A hidden spam trap and a rate limit block bots.
- **Ratings always match:** `products.rating` and `review_count` are recalculated by a database trigger from approved reviews only. The stars on product cards, the product page header and the reviews section always show the same numbers. These fields can no longer be typed into the product form.
- `-seed` adds 97 approved starter reviews across the demo products. In demo mode the same reviews are used, and demo card ratings are calculated from them. A review written in demo mode is saved in that browser only and marked "only visible to you".

## Blog (`/blog`)

- A journal listing with a featured post, category filters, tag filters, search and pagination.
- Article pages (`/blog/{slug}`) with Markdown content (headings, lists, tables, tips, links, images), reading time, share buttons (WhatsApp, Facebook, X, copy link), tags, a WhatsApp "Chat with a stylist" prompt, "Shop the look" products and related articles.
- SEO: per-post meta and Open Graph tags, `BlogPosting` structured data, an RSS feed at `/blog/rss.xml`, plus `/sitemap.xml` and `/robots.txt` for the whole site. Set `NEXT_PUBLIC_SITE_URL` to your public domain.
- The home page "Design tips & ideas" section shows the latest three posts.
- Raw HTML in post content is not rendered, so a post can't inject scripts into the page.
- `go run ./cmd/api -seed` adds four starter guides (curtain measuring, rug sizes, bedding, vertical blinds) if the blog is empty.

## Demo mode (works without a backend)

The storefront includes a demo copy of the seed catalogue and blog: 5 categories, 20 products and 4 articles. It's used automatically when:

- the API can't be reached, or returns an error (for example, the database is down), or
- the database has no products or no blog posts yet.

Shoppers can still browse, filter, search, view products and articles, add to cart and check out. A demo checkout is priced and saved in the browser, gets a `DEMO-XXXXXX` reference, and is sent through the same WhatsApp message to the store's number. Online payment is hidden for demo orders. The admin dashboard always needs the real API.

As soon as the database has real products or posts, they replace the demo content. A search with no matches in a real catalogue shows "no results", not demo items. Demo product and post URLs return 404 on a live store.

- Set `NEXT_PUBLIC_DEMO_FALLBACK=false` in production so an outage shows an empty store, not sample products.
- The demo data is generated from the backend seed files. After changing `backend/migrations/seed/*.sql`, run `python3 scripts/gen-demo-data.py` in `frontend/`.

## Admin dashboard (`/admin`)

- **Overview**: paid revenue (orders + invoices), orders, open orders, unpaid/overdue invoices, stock alerts, inventory value, 30-day revenue chart, channel split, top products, recent orders and invoices, money owed, low-stock list
- **Orders**: filter by status, payment, channel; search; update fulfilment and payment status; message the customer on WhatsApp; re-check payment with the provider
- **Products**: create, edit and delete; images by upload (Supabase Storage) or URL; colours, sizes, badge, featured, visibility
- **Inventory**: +/− stock adjustments with reasons, plus a movement history
- **Reviews**: approve, reject or delete customer reviews; filter by status or stars; search
- **Blog**: write posts in Markdown with a formatting toolbar and live preview; cover and inline image upload; drafts, scheduled publishing, featured post; categories and tags; SEO title, description and slug; a "Shop the look" product category
- **Invoices**: bill customers for custom work, such as made-to-measure curtains or installation, and share a secure payment link (details below)
- **Categories**, **Subscribers** (CSV export), **Settings** (WhatsApp number, delivery fee, free-delivery threshold, announcement, contact details, integration status)
- **Staff & roles** (admins only): approve staff and manage groups (details below)
- **My account**: profile, the sections you can use, change password

The first admin is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` on API start-up if no approved admin exists. If that email already has an account (e.g. it signed up as staff), it's promoted to admin instead. Use this to get back in if every admin is locked out.

### Staff accounts and roles

- **Admins** can use everything, including **Staff & roles**. **Staff** only see the sections their **group** allows.
- **Signing up:** new staff request access at **`/admin/register`** (there's a *Request access* link on the sign-in page). Their account is **pending** and can't sign in until an admin approves it. If WhatsApp owner alerts are set up, you get a message for each request, and the sidebar shows a count of pending requests.
- **Approving:** in **Admin → Staff & roles → Team members**, admins can:
  - **Approve** or **Disapprove** accounts;
  - assign each staff member to a group;
  - make someone an admin or staff;
  - delete accounts.
- **Disapproving** someone signs them out **immediately**: the API checks the account on every request, not just at sign-in. They see "Your access has been disapproved…" until an admin approves them again.
- **Groups:** in **Groups → New group**, give the group a name, tick the sections it can use, and tick its members. The sections are:
  - Overview & sales stats
  - Orders
  - Invoices
  - Products & categories
  - Inventory
  - Reviews
  - Blog
  - Subscribers
  - Store settings

  Each staff member is in one group. Staff with no group can sign in but only see *My account*.
- **Safeguards:** nobody can change their own role or approval, and the last approved admin can't be demoted, disapproved or deleted.
- **Enforced by the API:** each admin endpoint requires its section, and a hidden menu item isn't the only protection. Staff without access get `403`, and the dashboard shows a *No access* page.

### Invoices

1. **Create the invoice:** go to **Admin → Invoices → New invoice**.
   - Enter the customer's name, phone, and optionally email and address.
   - Add lines, either by searching the catalogue or typing any item or service with a quantity and price.
   - Add an optional discount, delivery fee, VAT % and due date.
   - Add notes, e.g. bank details or a delivery timeline.

   Totals are calculated on the server.
- **Stock:** catalogue products on an invoice are **reserved from stock when it's created**, just like website orders. If there isn't enough stock, the invoice is refused with "only N left".
  - Editing an unpaid invoice moves only the difference.
  - **Voiding** or **deleting** an unpaid invoice puts the stock back, and reopening a void invoice takes it again.
  - Every change appears in **Inventory → movements** as "Invoice INV-…".
  - Typed items or services, such as installation, never affect stock.
2. **Share the link:** after saving you get a **payment link** (`/invoice/{token}`), plus **Copy**, **Send on WhatsApp** (pre-filled message to the customer's number) and **Send by email** buttons.
3. **The customer's page** shows the invoice with your logo and contact details. They can **pay with Paystack or Flutterwave**, or **download a PDF**. Without an email on the invoice, they're asked for one before paying, since the providers need it. The page works on phones and prints cleanly.
4. **Online payments** are verified with the provider (amount and currency) through the callback or webhook, using the same rules as orders. The invoice then shows **Paid**, and you get a WhatsApp alert if owner alerts are set up.
5. **Status changes:**
   - **Mark as paid** for bank transfers or cash;
   - **Void** to stop the link accepting payments;
   - **Reopen** a void invoice, or undo a manual "paid".

   Unpaid invoices can be edited, and the link stays the same. Paid invoices are locked and can't be deleted.

Invoice links use a random 20-character token, so they can't be guessed from the invoice number. Search engines are told not to index them.

## Setup

### 1. Supabase

1. Create a project and copy the **connection string** (Project Settings → Database). The session pooler (port 5432) is recommended.
2. Optional, for image uploads: create a **public** Storage bucket named `product-images`, and copy the project URL and **service-role key**.

The API applies `backend/migrations/*.sql` on start-up (`AUTO_MIGRATE=true`). Row-level security is enabled on all tables, so the anon/public Supabase keys cannot read them. Only the API, using the database connection string, can.

### 2. API

```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, ADMIN_*, payment keys…
go run ./cmd/api -seed      # -seed loads the demo catalogue (only if products table is empty)
```

**Auto-restart on code changes (recommended for development):** `go run` builds once and doesn't notice later edits, so use [air](https://github.com/air-verse/air):

```bash
go install github.com/air-verse/air@v1.61.7   # one-time
export PATH="$PATH:$(go env GOPATH)/bin"      # one-time: add this line to ~/.bashrc or ~/.zshrc
cd backend
air                                           # instead of go run ./cmd/api
```

air rebuilds and restarts the API about a second after you save a `.go`, `.sql` or `.yaml` file, or `.env` (settings in [backend/.air.toml](backend/.air.toml)). If the new code doesn't compile, the error is shown and the previous server keeps running. To seed with air, run `go run ./cmd/api -seed -migrate` once.

Requires Go 1.26+ and Redis (`docker run -p 6379:6379 redis:7-alpine`). If Redis is down, the API still works without the cache.

### 3. Storefront

```bash
cd frontend
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:8080
npm install
npm run dev                 # http://localhost:3000  ·  admin: http://localhost:3000/admin
```

### Docker

```bash
cp backend/.env.example backend/.env   # fill it in
docker compose up --build
```

### Payment provider setup

| Provider | Callback (automatic) | Webhook URL to register |
|---|---|---|
| Paystack | `{FRONTEND_URL}/payment/callback?provider=paystack&order=…` | `{API_URL}/api/webhooks/paystack` |
| Flutterwave | `{FRONTEND_URL}/payment/callback?provider=flutterwave&order=…` | `{API_URL}/api/webhooks/flutterwave` (also set the *secret hash* to `FLUTTERWAVE_SECRET_HASH`) |

If a provider's secret key is blank, that option is hidden at checkout.

### WhatsApp

- Set the store's WhatsApp number in **Admin → Settings** (international format without `+`, e.g. `2348012345678`).
- Optional: set `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_NOTIFY_TO` to get a WhatsApp Cloud API message for every new order. Free-form messages are only delivered inside Meta's 24-hour window, so for production, switch `NotifyNewOrder` to an approved template.

### Customer order updates (email · SMS · WhatsApp)

Customers track an order at `/order/{reference}` on any device. The API sends them that link when the order is placed, and again when it's **paid, confirmed, shipped, delivered or cancelled**, including when an unpaid online order expires. Each channel switches on when its keys are set in `backend/.env`. Use any combination:

| Channel | Settings | Notes |
|---|---|---|
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Any SMTP service: Brevo, Resend, Zoho, Gmail app password, Amazon SES. Port 587 uses STARTTLS; port 465 uses TLS. Sends a branded email with the items, totals and a *Track your order* button. Use a sending domain you've verified with the provider, or messages go to spam. |
| SMS | `TERMII_API_KEY`, `TERMII_SENDER_ID`, `TERMII_BASE_URL`, `TERMII_CHANNEL` | [Termii](https://termii.com). Register a Sender ID first; approval takes a few days. Keep `TERMII_CHANNEL=dnd` so the message reaches numbers on Do-Not-Disturb, which is most Nigerian lines. Messages are one SMS part (≤160 characters) for most updates. |
| WhatsApp | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_CUSTOMER_TEMPLATE`, `WHATSAPP_TEMPLATE_LANG` | WhatsApp Cloud API. The store messages the customer first, so Meta requires an approved **template** (below). |

**WhatsApp template:** in Meta Business Manager → WhatsApp Manager → Message templates, create:

- **Category:** Utility
- **Name:** `order_update`. Put the same name in `WHATSAPP_CUSTOMER_TEMPLATE`.
- **Language:** English (`en`). Put the same code in `WHATSAPP_TEMPLATE_LANG`.
- **Body**, with 4 variables in this order:
  ```
  Hello {{1}}, {{2}}

  Order reference: {{3}}
  Track your order: {{4}}

  Thank you for choosing Chris Moore Interior Decor.
  ```
  Example values for review: `Ada` · `your order is on its way to you.` · `CM-AB12CD34` · `https://yourdomain.com/order/CM-AB12CD34`

**How sending works:**

- Messages are sent in the background, so checkout never waits on a mail server or SMS gateway.
- Each order event is sent **at most once per channel**, even when the payment callback and the webhook arrive together.
- Phone numbers like `0803…` are converted to `234803…` automatically.
- In **Admin → Orders → an order**, the *Customer messages* panel shows what was sent, on which channel, and any provider error, such as "insufficient balance" or "template not approved". From there you can resend any update.
- **Admin → Settings → Integrations** shows which channels are on.
- The checkout and order pages tell the shopper which channels their link was sent on.

## Caching

Public catalogue responses (`/api/settings`, `/api/categories`, `/api/products`, `/api/products/{slug}`) are cached in Redis for 10 minutes. The cache keys carry a version number. Any product, category, settings or stock change bumps that version, so stale data is never served. Redis also rate-limits login, staff sign-up, checkout, payment and newsletter requests. If Redis becomes unreachable, the API skips it for 15 seconds at a time instead of waiting on every request, so an outage never slows the store down.

## API docs (Swagger UI)

With the API running, open **http://localhost:8080/docs** for interactive Swagger UI. The raw OpenAPI 3 spec is at `/openapi.yaml`.

- To try admin endpoints: run `POST /api/admin/login` (**Try it out**, then **Execute**), copy the `token`, click **Authorize**, and paste it.
- Docs are on by default and off when `APP_ENV=production`. Set `DOCS_ENABLED=true` or `false` to override.
- The spec is written by hand in [backend/internal/api/openapi.yaml](backend/internal/api/openapi.yaml). `go test ./...` fails if any route in `server.go` is undocumented or the spec lists a route that doesn't exist. Update both together.

## API reference (summary)

Public: `GET|POST /api/products/{slug}/reviews?rating=&sort=&page=&limit=`, `GET /api/blog?category=&tag=&q=&featured=&page=&limit=`, `GET /api/blog/categories`, `GET /api/blog/{slug}`, `GET /api/settings`, `GET /api/categories`, `GET /api/products?category=&q=&sort=&min=&max=&featured=&page=&limit=`, `GET /api/products/{slug}`, `POST /api/orders`, `GET /api/orders/{ref}`, `GET /api/orders/{ref}/whatsapp`, `POST /api/orders/{ref}/pay`, `GET /api/payments/verify?reference=`, `POST /api/newsletter`

Admin (Bearer JWT): `POST /api/admin/login`, `GET /api/admin/stats`, CRUD under `/api/admin/products`, `/api/admin/categories`, `POST /api/admin/products/{id}/stock`, `GET /api/admin/inventory/movements`, `GET|PATCH /api/admin/orders[/{id}]`, `POST /api/admin/orders/{id}/verify-payment`, `POST /api/admin/orders/{id}/notify`, `GET|PUT /api/admin/settings`, CRUD under `/api/admin/blog`, `GET /api/admin/reviews`, `PATCH|DELETE /api/admin/reviews/{id}`, `GET /api/admin/subscribers`, `POST /api/admin/uploads`, CRUD under `/api/admin/invoices` + `PATCH /api/admin/invoices/{id}/status`; admins only: `GET /api/admin/staff`, `PATCH|DELETE /api/admin/staff/{id}`, CRUD under `/api/admin/groups`

Public invoices: `GET /api/invoices/{token}`, `POST /api/invoices/{token}/pay`. Staff sign-up: `POST /api/admin/register`

All money values are integers in **kobo** (₦1 = 100 kobo).

## Tests

```bash
cd backend && go test ./...      # payments + email/SMS/WhatsApp senders (against fake servers), validation, API spec sync
cd frontend && npm run lint && npm run build
```
=======
# chrismoore-decor
>>>>>>> origin/main
