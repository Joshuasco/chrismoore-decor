import type { BlogCategory, BlogPage, BlogPost, Category, Product, ProductPage, ReviewInput, ReviewPage, StoreSettings } from "./types";
import {
  DEMO_ENABLED,
  DEMO_SETTINGS,
  demoBlogCategories,
  demoBlogPage,
  demoCategories,
  demoPost,
  demoProduct,
  demoProductPage,
  demoReviewPage,
  isDemoId,
  saveLocalDemoReview,
} from "./demo";

// Server components can reach the API over an internal URL (API_URL);
// the browser always uses the public one.
export const PUBLIC_API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");

function baseURL() {
  if (typeof window === "undefined") {
    return (process.env.API_URL || PUBLIC_API_URL).replace(/\/$/, "");
  }
  return PUBLIC_API_URL;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(baseURL() + path, {
      cache: "no-store",
      // Don't let an unreachable API hang page rendering.
      signal: init.signal ?? AbortSignal.timeout(8000),
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    });
  } catch {
    throw new ApiError("We couldn't reach the store. Check your connection and try again.", 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  return data as T;
}

// ---------- Storefront reads with demo fallback ----------
//
// Each getter returns live data when the API answers with content. It falls
// back to the bundled demo catalogue/blog (lib/demo.ts) when the API is
// unreachable, errors (e.g. database down) or the catalogue is empty — so the
// site is fully browsable without a backend. A filtered query that simply
// matches nothing in a non-empty catalogue still returns "no results".

type Params = Record<string, string | number | boolean | undefined>;
type Result<T> = { ok: true; data: T } | { ok: false; status: number };

async function attempt<T>(path: string): Promise<Result<T>> {
  try {
    return { ok: true, data: await apiFetch<T>(path) };
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 0;
    if (status !== 404) console.warn(`[api] ${path} failed (${(e as Error).message})${DEMO_ENABLED ? " — using demo data" : ""}`);
    return { ok: false, status };
  }
}

const query = (params: Params) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && v !== false && q.set(k, String(v)));
  return q.toString();
};

const FILTER_KEYS = ["category", "q", "tag", "min", "max", "featured"];
const hasFilters = (params: Params) => FILTER_KEYS.some((k) => params[k] !== undefined && params[k] !== "" && params[k] !== false);

/** True when the live table is empty (or unreachable). */
async function liveIsEmpty(path: string) {
  const r = await attempt<{ total: number }>(path);
  return !r.ok || r.data.total === 0;
}

export async function getSettings(): Promise<StoreSettings> {
  const r = await attempt<StoreSettings>("/api/settings");
  if (r.ok) return r.data;
  return DEMO_ENABLED ? DEMO_SETTINGS : {};
}

export async function getCategories(): Promise<Category[]> {
  const r = await attempt<Category[]>("/api/categories");
  if (r.ok && r.data.length > 0) return r.data;
  return DEMO_ENABLED ? demoCategories : r.ok ? r.data : [];
}

export async function getProducts(params: Params = {}): Promise<ProductPage> {
  const r = await attempt<ProductPage>(`/api/products?${query(params)}`);
  if (r.ok && r.data.total > 0) return r.data;
  if (!DEMO_ENABLED) return r.ok ? r.data : { items: [], total: 0, page: 1, limit: Number(params.limit) || 12 };
  if (r.ok && hasFilters(params) && !(await liveIsEmpty("/api/products?limit=1"))) return r.data;
  return demoProductPage(params);
}

export async function getProduct(slug: string): Promise<{ product: Product; related: Product[] } | null> {
  const r = await attempt<{ product: Product; related: Product[] }>(`/api/products/${encodeURIComponent(slug)}`);
  if (r.ok) return r.data;
  if (!DEMO_ENABLED) {
    if (r.status === 404) return null;
    throw new ApiError("We couldn't reach the store.", r.status);
  }
  if (r.status === 404 && !(await liveIsEmpty("/api/products?limit=1"))) return null;
  return demoProduct(slug);
}

export async function getPosts(params: Params = {}): Promise<BlogPage> {
  const r = await attempt<BlogPage>(`/api/blog?${query(params)}`);
  if (r.ok && r.data.total > 0) return r.data;
  if (!DEMO_ENABLED) return r.ok ? r.data : { items: [], total: 0, page: 1, limit: Number(params.limit) || 9 };
  if (r.ok && hasFilters(params) && !(await liveIsEmpty("/api/blog?limit=1"))) return r.data;
  return demoBlogPage(params);
}

export async function getBlogCategories(): Promise<BlogCategory[]> {
  const r = await attempt<BlogCategory[]>("/api/blog/categories");
  if (r.ok && r.data.length > 0) return r.data;
  return DEMO_ENABLED ? demoBlogCategories() : r.ok ? r.data : [];
}

export async function getPost(slug: string): Promise<{ post: BlogPost; related: BlogPost[]; products: Product[] } | null> {
  const r = await attempt<{ post: BlogPost; related: BlogPost[]; products: Product[] }>(`/api/blog/${encodeURIComponent(slug)}`);
  if (r.ok) return r.data;
  if (!DEMO_ENABLED) {
    if (r.status === 404) return null;
    throw new ApiError("We couldn't reach the store.", r.status);
  }
  if (r.status === 404 && !(await liveIsEmpty("/api/blog?limit=1"))) return null;
  return demoPost(slug);
}

// ---------- Reviews ----------

const emptyReviews = (limit = 5): ReviewPage => ({
  items: [],
  total: 0,
  page: 1,
  limit,
  summary: { average: 0, count: 0, breakdown: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } },
});

/** Approved reviews + summary. Demo products use demo reviews; real products always use the API. */
export async function getReviews(slug: string, productId: string, params: Params = {}): Promise<ReviewPage> {
  if (DEMO_ENABLED && isDemoId(productId)) return demoReviewPage(slug, params);
  const r = await attempt<ReviewPage>(`/api/products/${encodeURIComponent(slug)}/reviews?${query(params)}`);
  return r.ok ? r.data : emptyReviews(Number(params.limit) || 5);
}

/** Submit a review. Returns the confirmation message shown to the shopper. */
export async function submitReview(slug: string, productId: string, input: ReviewInput): Promise<{ message: string; demo: boolean }> {
  if (DEMO_ENABLED && isDemoId(productId)) {
    saveLocalDemoReview(slug, productId, input);
    return { message: "Thanks for your review! (Demo mode — it's saved in this browser only.)", demo: true };
  }
  const res = await apiFetch<{ message: string }>(`/api/products/${encodeURIComponent(slug)}/reviews`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return { message: res.message, demo: false };
}

/** Public site URL for absolute links (sitemap, RSS, JSON-LD). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
