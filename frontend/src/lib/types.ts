// Mirrors backend/internal/models. Money is in kobo.

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  sort_order: number;
  product_count: number;
};

export type Product = {
  id: string;
  category_id: string | null;
  category_name: string;
  category_slug: string;
  name: string;
  slug: string;
  sku: string;
  short_description: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  stock: number;
  low_stock_threshold: number;
  images: string[];
  colors: string[];
  sizes: string[];
  material: string;
  badge: string;
  is_featured: boolean;
  is_active: boolean;
  rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
};

export type ProductPage = { items: Product[]; total: number; page: number; limit: number };

export type OrderItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  image_url: string;
  unit_price: number;
  quantity: number;
  color: string;
  size: string;
};

export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "failed" | "refunded";
export type Channel = "whatsapp" | "paystack" | "flutterwave";

export type Order = {
  id: string;
  reference: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  notes: string;
  subtotal: number;
  shipping_fee: number;
  total: number;
  channel: Channel;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_provider: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  item_count: number;
};

export type OrderPage = { items: Order[]; total: number; page: number; limit: number };

export type StoreSettings = Record<string, string>;

export type InventoryMovement = {
  id: string;
  product_id: string;
  product_name: string;
  change: number;
  reason: string;
  order_reference: string | null;
  actor: string;
  created_at: string;
};

export type DashboardStats = {
  revenue: number;
  revenue_this_month: number;
  orders_total: number;
  orders_pending: number;
  orders_today: number;
  products_active: number;
  low_stock: number;
  out_of_stock: number;
  inventory_value: number;
  subscribers: number;
  reviews_pending: number;
  sales_by_day: { day: string; revenue: number; orders: number }[];
  channel_split: Record<Channel, number>;
  top_products: { product_id: string; name: string; image_url: string; units: number; revenue: number }[];
  recent_orders: Order[];
  low_stock_products: Product[];
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content?: string;
  cover_image: string;
  category: string;
  tags: string[];
  author_name: string;
  status: "draft" | "published";
  is_featured: boolean;
  published_at: string | null;
  reading_minutes: number;
  product_category: string;
  seo_title: string;
  seo_description: string;
  created_at: string;
  updated_at: string;
};

export type BlogPage = { items: BlogPost[]; total: number; page: number; limit: number };
export type BlogCategory = { name: string; count: number };

export type Review = {
  id: string;
  product_id: string;
  name: string;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  created_at: string;
  // admin only
  email?: string;
  status?: "pending" | "approved" | "rejected";
  product_name?: string;
  product_slug?: string;
  product_image?: string;
};

export type ReviewSummary = { average: number; count: number; breakdown: Record<string, number> };
export type ReviewPage = { items: Review[]; total: number; page: number; limit: number; summary: ReviewSummary };
export type ReviewInput = { name: string; email: string; rating: number; title: string; body: string; website?: string };
