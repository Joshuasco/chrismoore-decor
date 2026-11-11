// Demo-mode data layer: a local, read-only copy of the seed catalogue and
// blog that mirrors the Go API's filtering, sorting and pagination. Used when
// the API/database is unreachable or empty (see lib/api.ts), so the whole
// storefront can be explored without a backend.
import { DEMO_CATEGORIES, DEMO_POSTS, DEMO_PRODUCTS, DEMO_REVIEWS } from "./demo-data";
import type { BlogCategory, BlogPage, BlogPost, Category, Order, Product, ProductPage, Review, ReviewInput, ReviewPage, ReviewSummary, StoreSettings } from "./types";

/** Set NEXT_PUBLIC_DEMO_FALLBACK=false in production to never show demo data. */
export const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO_FALLBACK !== "false";

export const DEMO_PREFIX = "demo-";
export const isDemoId = (id: string | null | undefined) => !!id && id.startsWith(DEMO_PREFIX);
export const isDemoReference = (ref: string) => ref.toUpperCase().startsWith("DEMO-");

// Stable timestamps: newest product first, posts N days old.
const BASE = Date.UTC(2026, 10, 1);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export const DEMO_SETTINGS: StoreSettings = {
  store_name: "Chris Moore Interior Decor",
  announcement: "Free delivery on orders above ₦300,000",
  shipping_fee: "500000",
  free_shipping_threshold: "30000000",
  paystack_enabled: "false",
  flutterwave_enabled: "false",
  demo_mode: "true",
};

export const demoCategories: Category[] = DEMO_CATEGORIES.map((c) => ({
  id: `${DEMO_PREFIX}cat-${c.slug}`,
  name: c.name,
  slug: c.slug,
  description: c.description,
  image_url: c.image_url,
  sort_order: c.sort_order,
  product_count: DEMO_PRODUCTS.filter((p) => p.category === c.slug).length,
}));

// ---------- Reviews ----------

/** Rating summary from approved reviews, rounded like the products.rating column. */
function summarize(ratings: number[]): ReviewSummary {
  const breakdown: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  ratings.forEach((r) => (breakdown[String(r)] += 1));
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  return { average: Math.round(avg * 10) / 10, count: ratings.length, breakdown };
}

const reviewSummaries = new Map<string, ReviewSummary>(
  DEMO_PRODUCTS.map((p) => [p.slug, summarize(DEMO_REVIEWS.filter((r) => r.product === p.slug).map((r) => r.rating))]),
);

export const demoProducts: Product[] = DEMO_PRODUCTS.map((p, i) => {
  const cat = demoCategories.find((c) => c.slug === p.category)!;
  const created = new Date(BASE - i * 86_400_000).toISOString();
  return {
    id: `${DEMO_PREFIX}${p.slug}`,
    category_id: cat.id,
    category_name: cat.name,
    category_slug: cat.slug,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    short_description: p.short_description,
    description: p.description,
    price: p.price,
    compare_at_price: p.compare_at_price,
    stock: p.stock,
    low_stock_threshold: 5,
    images: [...p.images],
    colors: [...p.colors],
    sizes: [...p.sizes],
    material: p.material,
    badge: p.badge,
    is_featured: p.is_featured,
    is_active: true,
    rating: reviewSummaries.get(p.slug)!.average,
    review_count: reviewSummaries.get(p.slug)!.count,
    created_at: created,
    updated_at: created,
  };
});

export const demoPosts = (): BlogPost[] =>
  DEMO_POSTS.map((p) => ({
    id: `${DEMO_PREFIX}post-${p.slug}`,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    content: p.content,
    cover_image: p.cover_image,
    category: p.category,
    tags: [...p.tags],
    author_name: "Chris Moore Interior Decor",
    status: "published",
    is_featured: p.is_featured,
    published_at: daysAgo(p.days_ago),
    reading_minutes: p.reading_minutes,
    product_category: p.product_category,
    seo_title: "",
    seo_description: p.seo_description,
    created_at: daysAgo(p.days_ago),
    updated_at: daysAgo(p.days_ago),
  }));

/** List endpoints omit the article body, like the API. */
const withoutContent = (p: BlogPost): BlogPost => ({ ...p, content: undefined });

type Params = Record<string, string | number | boolean | undefined>;
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));

function paginate<T>(items: T[], params: Params, defLimit: number, maxLimit: number) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(params.limit) || defLimit));
  return { items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit };
}

export function demoProductPage(params: Params = {}): ProductPage {
  const q = str(params.q).trim().toLowerCase();
  const min = Number(params.min) || 0;
  const max = Number(params.max) || 0;
  let items = demoProducts.filter(
    (p) =>
      (!params.category || p.category_slug === params.category) &&
      (!params.featured || String(params.featured) !== "true" || p.is_featured) &&
      (!min || p.price >= min) &&
      (!max || p.price <= max) &&
      (!q || [p.name, p.sku, p.description, p.category_name].some((f) => f.toLowerCase().includes(q))),
  );
  const sorters: Record<string, (a: Product, b: Product) => number> = {
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    popular: (a, b) => b.review_count - a.review_count || b.rating - a.rating,
    rating: (a, b) => b.rating - a.rating || b.review_count - a.review_count,
    name: (a, b) => a.name.localeCompare(b.name),
    stock: (a, b) => a.stock - b.stock,
  };
  items = [...items].sort(sorters[str(params.sort)] ?? ((a, b) => b.created_at.localeCompare(a.created_at)));
  return paginate(items, params, 12, 100);
}

export function demoProduct(slug: string) {
  const product = demoProducts.find((p) => p.slug === slug);
  if (!product) return null;
  const related = demoProducts
    .filter((p) => p.id !== product.id)
    .sort(
      (a, b) =>
        Number(b.category_id === product.category_id) - Number(a.category_id === product.category_id) ||
        Number(b.is_featured) - Number(a.is_featured) ||
        b.rating - a.rating,
    )
    .slice(0, 4);
  return { product, related };
}

export function demoBlogPage(params: Params = {}): BlogPage {
  const q = str(params.q).trim().toLowerCase();
  const tag = str(params.tag).toLowerCase();
  const category = str(params.category).toLowerCase();
  const items = demoPosts()
    .filter(
      (p) =>
        (!category || p.category.toLowerCase() === category) &&
        (!tag || p.tags.includes(tag)) &&
        (String(params.featured) !== "true" || p.is_featured) &&
        (!q || [p.title, p.excerpt, p.content ?? "", p.category].some((f) => f.toLowerCase().includes(q))),
    )
    .sort((a, b) => b.published_at!.localeCompare(a.published_at!))
    .map(withoutContent);
  return paginate(items, params, 9, 50);
}

export function demoBlogCategories(): BlogCategory[] {
  const counts = new Map<string, number>();
  demoPosts().forEach((p) => counts.set(p.category, (counts.get(p.category) ?? 0) + 1));
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function demoPost(slug: string) {
  const all = demoPosts();
  const post = all.find((p) => p.slug === slug);
  if (!post) return null;
  const overlap = (p: BlogPost) => p.tags.filter((t) => post.tags.includes(t)).length;
  const related = all
    .filter((p) => p.id !== post.id)
    .sort(
      (a, b) =>
        Number(b.category === post.category) - Number(a.category === post.category) ||
        overlap(b) - overlap(a) ||
        b.published_at!.localeCompare(a.published_at!),
    )
    .slice(0, 3)
    .map(withoutContent);
  const products = post.product_category ? demoProductPage({ category: post.product_category, sort: "popular", limit: 4 }).items : [];
  return { post, related, products };
}

// ---------- Simulated checkout (browser only) ----------

const ORDERS_KEY = "cmd-demo-orders";

function readOrders(): Record<string, Order> {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function getDemoOrder(reference: string): Order | null {
  return readOrders()[reference.toUpperCase()] ?? null;
}

type DemoCheckout = {
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  notes: string;
  items: { product_id: string; quantity: number; color: string; size: string }[];
};

/** Prices the cart from the demo catalogue and stores the order locally. */
export function createDemoOrder(req: DemoCheckout, settings: StoreSettings): Order {
  const lines = req.items.map((it, i) => {
    const p = demoProducts.find((x) => x.id === it.product_id);
    if (!p) throw new Error("A product in your cart is no longer available.");
    if (p.stock < it.quantity) throw new Error(p.stock <= 0 ? `${p.name} is out of stock` : `Only ${p.stock} of ${p.name} left in stock`);
    return {
      id: `line-${i}`,
      product_id: p.id,
      product_name: p.name,
      sku: p.sku,
      image_url: p.images[0] ?? "",
      unit_price: p.price,
      quantity: it.quantity,
      color: it.color,
      size: it.size,
    };
  });
  const subtotal = lines.reduce((n, l) => n + l.unit_price * l.quantity, 0);
  const fee = Number(settings.shipping_fee || DEMO_SETTINGS.shipping_fee);
  const freeOver = Number(settings.free_shipping_threshold || DEMO_SETTINGS.free_shipping_threshold);
  const shipping = freeOver > 0 && subtotal >= freeOver ? 0 : fee;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const reference = "DEMO-" + Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alphabet[b % alphabet.length]).join("");
  const now = new Date().toISOString();
  const order: Order = {
    id: reference,
    reference,
    customer_name: req.customer_name.trim(),
    email: req.email.trim(),
    phone: req.phone.trim(),
    address: req.address.trim(),
    city: req.city,
    state: req.state,
    notes: req.notes,
    subtotal,
    shipping_fee: shipping,
    total: subtotal + shipping,
    channel: "whatsapp",
    status: "pending",
    payment_status: "unpaid",
    payment_provider: "",
    paid_at: null,
    created_at: now,
    updated_at: now,
    items: lines,
    item_count: lines.reduce((n, l) => n + l.quantity, 0),
  };
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify({ ...readOrders(), [reference]: order }));
  } catch {}
  return order;
}

const naira = (kobo: number) => "₦" + Math.round(kobo / 100).toLocaleString("en-NG");

/** Same message format as backend/internal/whatsapp.OrderMessage. */
export function demoWhatsAppLink(order: Order, whatsappNumber: string, orderUrl: string) {
  const lines = order.items.map((it) => {
    const opts = [it.color, it.size].filter(Boolean).join(", ");
    return `• ${it.quantity} × ${it.product_name}${opts ? ` (${opts})` : ""} — ${naira(it.unit_price * it.quantity)}`;
  });
  const place = [order.city, order.state].filter(Boolean).join(", ");
  const text =
    `Hello Chris Moore Interior Decor! 👋\nI'd like to place an order.\n\n*Order ref:* ${order.reference}\n\n${lines.join("\n")}\n\n` +
    `Subtotal: ${naira(order.subtotal)}\nDelivery: ${naira(order.shipping_fee)}\n*Total: ${naira(order.total)}*\n\n` +
    `*Name:* ${order.customer_name}\n*Phone:* ${order.phone}\n*Address:* ${order.address}${place ? `, ${place}` : ""}` +
    (order.notes ? `\n*Notes:* ${order.notes}` : "") +
    `\n\nOrder details: ${orderUrl}`;
  return `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

// ---------- Reviews (demo) ----------

const demoReviews = (slug: string): Review[] =>
  DEMO_REVIEWS.flatMap((r, i) =>
    r.product === slug
      ? [{
          id: `${DEMO_PREFIX}review-${i}`,
          product_id: `${DEMO_PREFIX}${slug}`,
          name: r.name,
          rating: r.rating,
          title: r.title,
          body: r.body,
          verified: r.verified,
          created_at: daysAgo(r.days_ago),
        }]
      : [],
  );

export function demoReviewPage(slug: string, params: Params = {}): ReviewPage {
  const rating = Number(params.rating) || 0;
  const sorters: Record<string, (a: Review, b: Review) => number> = {
    highest: (a, b) => b.rating - a.rating || b.created_at.localeCompare(a.created_at),
    lowest: (a, b) => a.rating - b.rating || b.created_at.localeCompare(a.created_at),
  };
  const items = demoReviews(slug)
    .filter((r) => !rating || r.rating === rating)
    .sort(sorters[str(params.sort)] ?? ((a, b) => b.created_at.localeCompare(a.created_at)));
  const page = paginate(items, params, 5, 50);
  return { ...page, summary: reviewSummaries.get(slug) ?? summarize([]) };
}

// Reviews written in demo mode stay in this browser and are shown only to their author.
const REVIEWS_KEY = "cmd-demo-reviews";

export function getLocalDemoReviews(slug: string): Review[] {
  try {
    return (JSON.parse(localStorage.getItem(REVIEWS_KEY) || "{}") as Record<string, Review[]>)[slug] ?? [];
  } catch {
    return [];
  }
}

export function saveLocalDemoReview(slug: string, productId: string, input: ReviewInput): Review {
  const review: Review = {
    id: `${DEMO_PREFIX}local-${Date.now()}`,
    product_id: productId,
    name: input.name.trim(),
    rating: input.rating,
    title: input.title.trim(),
    body: input.body.trim(),
    verified: false,
    created_at: new Date().toISOString(),
    status: "pending",
  };
  try {
    const all = JSON.parse(localStorage.getItem(REVIEWS_KEY) || "{}") as Record<string, Review[]>;
    all[slug] = [review, ...(all[slug] ?? [])];
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(all));
  } catch {}
  return review;
}
