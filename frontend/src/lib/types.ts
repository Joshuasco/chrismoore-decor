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
  cost_price: number;
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

export type NotificationEvent = "placed" | "paid" | "confirmed" | "shipped" | "delivered" | "cancelled";

/** A message sent to the customer about their order. */
export type OrderNotification = {
  id: string;
  order_id: string;
  event: NotificationEvent;
  channel: "email" | "sms" | "whatsapp";
  recipient: string;
  status: "sending" | "sent" | "failed";
  error: string;
  attempts: number;
  created_at: string;
  updated_at: string;
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
  /** Paid orders + paid invoices. */
  revenue: number;
  revenue_this_month: number;
  invoice_revenue: number;
  invoices_unpaid: number;
  invoices_outstanding: number;
  invoices_overdue: number;
  invoices_overdue_amount: number;
  recent_invoices: Invoice[];
  orders_total: number;
  orders_pending: number;
  orders_today: number;
  products_active: number;
  low_stock: number;
  out_of_stock: number;
  inventory_value: number;
  subscribers: number;
  reviews_pending: number;
  sales_by_day: { day: string; revenue: number; orders: number; invoice_revenue: number }[];
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

// ---------- Admin accounts & roles ----------

export type Permission = {
  key: string;
  label: string;
  resource?: string;
  action?: string;
  description?: string;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "staff";
  status: "pending" | "approved" | "disapproved";
  group_id: string | null;
  group_name: string;
  group_permissions?: string[];
  direct_permissions?: string[];
  permissions: string[];
  status_changed_at: string | null;
  last_login_at: string | null;
  created_at: string;
};

export type Me = AdminUser & { pending_staff?: number };

export type StaffGroup = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  member_ids: string[];
  created_at: string;
  updated_at: string;
};

// ---------- Invoices ----------

export type InvoiceItem = {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

export type Invoice = {
  id?: string;
  number: string;
  token: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  tax_rate: number;
  tax: number;
  total: number;
  status: "unpaid" | "paid" | "void";
  overdue: boolean;
  due_date: string;
  payment_provider: string;
  paid_at: string | null;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  items: InvoiceItem[];
};

export type InvoiceDetail = { invoice: Invoice; invoice_url: string; whatsapp_url: string; email_url: string };

export type InvoicePage = { items: Invoice[]; total: number; page: number; limit: number };

// ---------- Procurement ----------

export type Supplier = {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  payment_terms: string;
  bank_details: string;
  lead_time_days: number;
  notes: string;
  is_active: boolean;
  po_count?: number;
  total_spent?: number;
  created_at: string;
  updated_at: string;
};

export type SupplierInput = Omit<Supplier, "id" | "po_count" | "total_spent" | "created_at" | "updated_at">;

export type SupplierPage = { items: Supplier[]; total: number; page: number; limit: number };

export type PurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  total_cost: number;
};

export type PurchaseOrderItemInput = {
  product_id?: string | null;
  product_name: string;
  sku?: string;
  quantity_ordered: number;
  unit_cost: number;
};

export type ProcurementPayment = {
  id: string;
  purchase_order_id: string;
  amount: number;
  payment_method: string;
  reference: string;
  paid_at: string;
  created_by_name: string;
  notes: string;
};

export type ProcurementPaymentInput = {
  amount: number;
  payment_method: string;
  reference?: string;
  notes?: string;
};

export type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name: string;
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
  payment_status: "unpaid" | "partially_paid" | "paid";
  subtotal: number;
  shipping_cost: number;
  customs_duty: number;
  other_costs: number;
  tax_amount: number;
  total_cost: number;
  amount_paid: number;
  order_date: string;
  expected_delivery_date: string;
  received_at: string | null;
  tracking_number: string;
  shipping_carrier: string;
  created_by: string | null;
  created_by_name: string;
  notes: string;
  items: PurchaseOrderItem[];
  payments?: ProcurementPayment[];
  created_at: string;
  updated_at: string;
};

export type PurchaseOrderInput = {
  supplier_id: string;
  order_date?: string;
  expected_delivery_date?: string;
  tracking_number?: string;
  shipping_carrier?: string;
  shipping_cost?: number;
  customs_duty?: number;
  other_costs?: number;
  tax_amount?: number;
  notes?: string;
  items: PurchaseOrderItemInput[];
};

export type PurchaseOrderPage = { items: PurchaseOrder[]; total: number; page: number; limit: number };

export type ReceiveGoodsItem = {
  item_id: string;
  quantity_received: number;
};

export type ReceiveGoodsInput = {
  items: ReceiveGoodsItem[];
  update_cost_price?: boolean;
  notes?: string;
};

export type ProcurementStats = {
  total_spend: number;
  spend_this_month: number;
  pending_pos_count: number;
  unpaid_supplier_amount: number;
  active_suppliers_count: number;
  total_inventory_cost: number;
  total_inventory_retail: number;
};
