package models

import (
	"strings"
	"time"
)

// All monetary amounts are integers in kobo.

type Category struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Slug         string    `json:"slug"`
	Description  string    `json:"description"`
	ImageURL     string    `json:"image_url"`
	SortOrder    int       `json:"sort_order"`
	ProductCount int       `json:"product_count"`
	CreatedAt    time.Time `json:"created_at"`
}

type Product struct {
	ID                string    `json:"id"`
	CategoryID        *string   `json:"category_id"`
	CategoryName      string    `json:"category_name"`
	CategorySlug      string    `json:"category_slug"`
	Name              string    `json:"name"`
	Slug              string    `json:"slug"`
	SKU               string    `json:"sku"`
	ShortDescription  string    `json:"short_description"`
	Description       string    `json:"description"`
	Price             int64     `json:"price"`
	CompareAtPrice    *int64    `json:"compare_at_price"`
	CostPrice         int64     `json:"cost_price"`
	Stock             int       `json:"stock"`
	LowStockThreshold int       `json:"low_stock_threshold"`
	Images            []string  `json:"images"`
	Colors            []string  `json:"colors"`
	Sizes             []string  `json:"sizes"`
	Material          string    `json:"material"`
	Badge             string    `json:"badge"`
	IsFeatured        bool      `json:"is_featured"`
	IsActive          bool      `json:"is_active"`
	Rating            float64   `json:"rating"`
	ReviewCount       int       `json:"review_count"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type ProductInput struct {
	CategoryID        *string  `json:"category_id"`
	Name              string   `json:"name"`
	Slug              string   `json:"slug"`
	SKU               string   `json:"sku"`
	ShortDescription  string   `json:"short_description"`
	Description       string   `json:"description"`
	Price             int64    `json:"price"`
	CompareAtPrice    *int64   `json:"compare_at_price"`
	CostPrice         int64    `json:"cost_price"`
	Stock             int      `json:"stock"`
	LowStockThreshold int      `json:"low_stock_threshold"`
	Images            []string `json:"images"`
	Colors            []string `json:"colors"`
	Sizes             []string `json:"sizes"`
	Material          string   `json:"material"`
	Badge             string   `json:"badge"`
	IsFeatured        bool     `json:"is_featured"`
	IsActive          bool     `json:"is_active"`
}

type CategoryInput struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	ImageURL    string `json:"image_url"`
	SortOrder   int    `json:"sort_order"`
}

type ProductFilter struct {
	Category string
	Query    string
	Sort     string // newest | price_asc | price_desc | popular | name
	Featured bool
	MinPrice int64
	MaxPrice int64
	Page     int
	Limit    int
	// Admin listings include inactive products.
	IncludeInactive bool
	LowStockOnly    bool
}

type ProductPage struct {
	Items []Product `json:"items"`
	Total int       `json:"total"`
	Page  int       `json:"page"`
	Limit int       `json:"limit"`
}

type OrderItem struct {
	ID          string  `json:"id"`
	ProductID   *string `json:"product_id"`
	ProductName string  `json:"product_name"`
	SKU         string  `json:"sku"`
	ImageURL    string  `json:"image_url"`
	UnitPrice   int64   `json:"unit_price"`
	Quantity    int     `json:"quantity"`
	Color       string  `json:"color"`
	Size        string  `json:"size"`
}

type Order struct {
	ID              string      `json:"id"`
	Reference       string      `json:"reference"`
	CustomerName    string      `json:"customer_name"`
	Email           string      `json:"email"`
	Phone           string      `json:"phone"`
	Address         string      `json:"address"`
	City            string      `json:"city"`
	State           string      `json:"state"`
	Notes           string      `json:"notes"`
	Subtotal        int64       `json:"subtotal"`
	ShippingFee     int64       `json:"shipping_fee"`
	Total           int64       `json:"total"`
	Channel         string      `json:"channel"`
	Status          string      `json:"status"`
	PaymentStatus   string      `json:"payment_status"`
	PaymentProvider string      `json:"payment_provider"`
	PaidAt          *time.Time  `json:"paid_at"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
	Items           []OrderItem `json:"items"`
	ItemCount       int         `json:"item_count"`
}

type CheckoutItem struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
	Color     string `json:"color"`
	Size      string `json:"size"`
}

type CheckoutRequest struct {
	CustomerName string         `json:"customer_name"`
	Email        string         `json:"email"`
	Phone        string         `json:"phone"`
	Address      string         `json:"address"`
	City         string         `json:"city"`
	State        string         `json:"state"`
	Notes        string         `json:"notes"`
	Channel      string         `json:"channel"`
	Items        []CheckoutItem `json:"items"`
}

type OrderFilter struct {
	Status        string
	PaymentStatus string
	Channel       string
	Query         string
	Page          int
	Limit         int
}

type OrderPage struct {
	Items []Order `json:"items"`
	Total int     `json:"total"`
	Page  int     `json:"page"`
	Limit int     `json:"limit"`
}

type Payment struct {
	ID        string `json:"id"`
	OrderID   string `json:"order_id"`   // "" for invoice payments
	InvoiceID string `json:"invoice_id"` // "" for order payments
	Provider  string `json:"provider"`
	Reference string `json:"reference"`
	Amount    int64  `json:"amount"`
	Status    string `json:"status"`
}

type InventoryMovement struct {
	ID          string    `json:"id"`
	ProductID   string    `json:"product_id"`
	ProductName string    `json:"product_name"`
	Change      int       `json:"change"`
	Reason      string    `json:"reason"`
	OrderRef    *string   `json:"order_reference"` // order reference or invoice number
	Actor       string    `json:"actor"`
	CreatedAt   time.Time `json:"created_at"`
}

type AdminUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	// Role is "admin" (full access, manages staff) or "staff".
	Role string `json:"role"`
	// Status is "pending" (awaiting approval), "approved" or "disapproved".
	Status          string     `json:"status"`
	GroupID           *string    `json:"group_id"`
	GroupName         string     `json:"group_name"`
	GroupPermissions  []string   `json:"group_permissions,omitempty"`
	DirectPermissions []string   `json:"direct_permissions"`
	Permissions       []string   `json:"permissions"` // effective services and actions this user can access
	PasswordHash      string     `json:"-"`
	StatusChangedAt   *time.Time `json:"status_changed_at"`
	LastLoginAt       *time.Time `json:"last_login_at"`
	CreatedAt         time.Time  `json:"created_at"`
}

// Can reports whether the user may use a dashboard service or specific action.
func (u AdminUser) Can(perm string) bool {
	if u.Role == "admin" {
		return true
	}
	parts := strings.Split(perm, ":")
	resource := parts[0]
	action := ""
	if len(parts) > 1 {
		action = strings.Join(parts[1:], ":")
	}

	for _, p := range u.Permissions {
		if p == perm || p == "*" {
			return true
		}
		// Resource wildcard: "products:*"
		if p == resource+":*" {
			// Cost price access requires explicit permission unless granted legacy coarse
			if strings.HasPrefix(action, "cost_price") && !strings.Contains(p, "cost_price") {
				continue
			}
			return true
		}
		// Legacy coarse permission: "products" satisfies standard CRUD and actions
		if p == resource {
			return true
		}
	}
	return false
}

// Permission is a grantable service or granular capability.
type Permission struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Resource    string `json:"resource"`
	Action      string `json:"action,omitempty"`
	Description string `json:"description,omitempty"`
}

// Permissions lists every grantable service and action. Managing staff and groups is
// reserved for admins and isn't grantable.
var Permissions = []Permission{
	// Legacy / High-level services
	{"dashboard", "Overview & sales stats", "dashboard", "*", "Full access to dashboard"},
	{"orders", "Orders (Full access)", "orders", "*", "Full access to orders"},
	{"invoices", "Invoices (Full access)", "invoices", "*", "Full access to invoices"},
	{"products", "Products (Full access)", "products", "*", "Full access to products and categories"},
	{"inventory", "Inventory (Full access)", "inventory", "*", "Full access to inventory"},
	{"procurement", "Procurement (Full access)", "procurement", "*", "Full access to procurement and suppliers"},
	{"reviews", "Reviews (Full access)", "reviews", "*", "Full access to customer reviews"},
	{"blog", "Blog (Full access)", "blog", "*", "Full access to articles"},
	{"subscribers", "Subscribers (Full access)", "subscribers", "*", "Full access to subscribers"},
	{"settings", "Store settings (Full access)", "settings", "*", "Full access to settings"},

	// Granular CRUD and field-level permissions
	{"dashboard:read", "View Overview & Stats", "dashboard", "read", "View dashboard summary charts and revenue metrics"},

	{"products:read", "View Products & Categories", "products", "read", "Browse catalog products and categories"},
	{"products:create", "Create Products", "products", "create", "Add new products and product categories"},
	{"products:update", "Edit Products", "products", "update", "Modify product details, descriptions, and categories"},
	{"products:delete", "Delete Products", "products", "delete", "Remove products or product categories from catalog"},
	{"products:cost_price:read", "View Cost Price & Margins", "products", "cost_price:read", "View wholesale cost prices, unit profit, and margin percentages"},
	{"products:cost_price:update", "Edit Cost Price", "products", "cost_price:update", "Update product wholesale cost prices"},
	{"products:pricing:update", "Edit Selling Price", "products", "pricing:update", "Change selling prices and compare-at discounted prices"},

	{"inventory:read", "View Stock & Movements", "inventory", "read", "Inspect stock levels and stock movement logs"},
	{"inventory:update", "Adjust Stock", "inventory", "update", "Increase, decrease, or reconcile product inventory stock"},

	{"orders:read", "View Orders", "orders", "read", "Inspect customer orders and shipping details"},
	{"orders:create", "Create Orders", "orders", "create", "Place customer orders directly in the admin portal"},
	{"orders:update", "Update Orders", "orders", "update", "Change order status, tracking information, and verify payments"},
	{"orders:delete", "Delete Orders", "orders", "delete", "Cancel and delete customer orders"},

	{"invoices:read", "View Invoices", "invoices", "read", "Inspect generated customer invoices"},
	{"invoices:create", "Create Invoices", "invoices", "create", "Draft and send new invoices to customers"},
	{"invoices:update", "Edit Invoices", "invoices", "update", "Edit invoice line items, delivery fees, and statuses"},
	{"invoices:delete", "Delete Invoices", "invoices", "delete", "Void and delete customer invoices"},

	{"procurement:read", "View Procurement & Suppliers", "procurement", "read", "Browse suppliers and purchase orders"},
	{"procurement:create", "Create Purchase Orders & Suppliers", "procurement", "create", "Draft purchase orders and register new suppliers"},
	{"procurement:update", "Edit Purchase Orders & Suppliers", "procurement", "update", "Modify purchase order headers, line items, and supplier profiles"},
	{"procurement:delete", "Delete Purchase Orders & Suppliers", "procurement", "delete", "Delete unfulfilled purchase orders and inactive suppliers"},
	{"procurement:receive", "Receive Goods into Stock", "procurement", "receive", "Inspect and record incoming shipments into active inventory"},
	{"procurement:pay", "Record Supplier Payments", "procurement", "pay", "Log payments and wire transfers to suppliers"},

	{"blog:read", "View Blog Posts", "blog", "read", "Read drafts and published blog articles"},
	{"blog:create", "Create Blog Posts", "blog", "create", "Write and publish new blog articles"},
	{"blog:update", "Edit Blog Posts", "blog", "update", "Edit blog content and cover images"},
	{"blog:delete", "Delete Blog Posts", "blog", "delete", "Delete blog posts"},

	{"reviews:read", "View Reviews", "reviews", "read", "Browse customer feedback and reviews"},
	{"reviews:update", "Moderate Reviews", "reviews", "update", "Approve, feature, or hide customer reviews"},
	{"reviews:delete", "Delete Reviews", "reviews", "delete", "Permanently remove customer reviews"},

	{"subscribers:read", "View Subscribers", "subscribers", "read", "View and export newsletter subscriber list"},
	{"subscribers:delete", "Delete Subscribers", "subscribers", "delete", "Remove subscribers from newsletter list"},

	{"settings:read", "View Store Settings", "settings", "read", "Inspect store contact and shipping configurations"},
	{"settings:update", "Update Store Settings", "settings", "update", "Save changes to store settings, policies, and fees"},
}

// PermissionKeys returns the keys of Permissions.
func PermissionKeys() []string {
	out := make([]string, len(Permissions))
	for i, p := range Permissions {
		out[i] = p.Key
	}
	return out
}

type StaffGroup struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Permissions []string  `json:"permissions"`
	MemberIDs   []string  `json:"member_ids"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type StaffGroupInput struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
	// MemberIDs, when present, replaces the group's members.
	MemberIDs *[]string `json:"member_ids"`
}

// StaffUpdate changes a user's access. Nil fields are left unchanged; an
// empty GroupID removes the user from their group.
type StaffUpdate struct {
	Status            *string   `json:"status"`
	Role              *string   `json:"role"`
	GroupID           *string   `json:"group_id"`
	DirectPermissions *[]string `json:"direct_permissions"`
}

// ---------- Invoices ----------

type Invoice struct {
	ID              string        `json:"id,omitempty"`
	Number          string        `json:"number"`
	Token           string        `json:"token"`
	CustomerName    string        `json:"customer_name"`
	Email           string        `json:"email"`
	Phone           string        `json:"phone"`
	Address         string        `json:"address"`
	Notes           string        `json:"notes"`
	Subtotal        int64         `json:"subtotal"`
	Discount        int64         `json:"discount"`
	DeliveryFee     int64         `json:"delivery_fee"`
	TaxRate         float64       `json:"tax_rate"` // percent, e.g. 7.5
	Tax             int64         `json:"tax"`
	Total           int64         `json:"total"`
	Status          string        `json:"status"` // unpaid, paid, void
	Overdue         bool          `json:"overdue"`
	DueDate         string        `json:"due_date"` // YYYY-MM-DD or ""
	PaymentProvider string        `json:"payment_provider"`
	PaidAt          *time.Time    `json:"paid_at"`
	CreatedByName   string        `json:"created_by_name,omitempty"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
	Items           []InvoiceItem `json:"items"`
}

type InvoiceItem struct {
	ID          string  `json:"id"`
	ProductID   *string `json:"product_id"`
	Description string  `json:"description"`
	Quantity    int     `json:"quantity"`
	UnitPrice   int64   `json:"unit_price"`
	Amount      int64   `json:"amount"`
}

type InvoiceItemInput struct {
	ProductID   string `json:"product_id"`
	Description string `json:"description"`
	Quantity    int    `json:"quantity"`
	UnitPrice   int64  `json:"unit_price"`
}

type InvoiceInput struct {
	CustomerName string             `json:"customer_name"`
	Email        string             `json:"email"`
	Phone        string             `json:"phone"`
	Address      string             `json:"address"`
	Notes        string             `json:"notes"`
	Items        []InvoiceItemInput `json:"items"`
	Discount     int64              `json:"discount"`
	DeliveryFee  int64              `json:"delivery_fee"`
	TaxRate      float64            `json:"tax_rate"`
	DueDate      string             `json:"due_date"`
}

type InvoiceFilter struct {
	Status string // unpaid, paid, void, overdue
	Query  string
	Page   int
	Limit  int
}

type InvoicePage struct {
	Items []Invoice `json:"items"`
	Total int       `json:"total"`
	Page  int       `json:"page"`
	Limit int       `json:"limit"`
}

type DailySales struct {
	Day     string `json:"day"`
	Revenue int64  `json:"revenue"` // paid orders + paid invoices
	Orders  int    `json:"orders"`
	// InvoiceRevenue is the paid-invoice part of Revenue.
	InvoiceRevenue int64 `json:"invoice_revenue"`
}

type TopProduct struct {
	ProductID string `json:"product_id"`
	Name      string `json:"name"`
	ImageURL  string `json:"image_url"`
	Units     int    `json:"units"`
	Revenue   int64  `json:"revenue"`
}

type DashboardStats struct {
	// Revenue and RevenueThisMonth include paid orders and paid invoices.
	Revenue          int64 `json:"revenue"`
	RevenueThisMonth int64 `json:"revenue_this_month"`
	InvoiceRevenue   int64 `json:"invoice_revenue"` // the paid-invoice part of Revenue
	// Unpaid invoices: how many, and how much is owed.
	InvoicesUnpaid        int            `json:"invoices_unpaid"`
	InvoicesOutstanding   int64          `json:"invoices_outstanding"`
	InvoicesOverdue       int            `json:"invoices_overdue"`
	InvoicesOverdueAmount int64          `json:"invoices_overdue_amount"`
	RecentInvoices        []Invoice      `json:"recent_invoices"`
	OrdersTotal           int            `json:"orders_total"`
	OrdersPending         int            `json:"orders_pending"`
	OrdersToday           int            `json:"orders_today"`
	ProductsActive        int            `json:"products_active"`
	LowStock              int            `json:"low_stock"`
	OutOfStock            int            `json:"out_of_stock"`
	InventoryValue        int64          `json:"inventory_value"`
	Subscribers           int            `json:"subscribers"`
	ReviewsPending        int            `json:"reviews_pending"`
	SalesByDay            []DailySales   `json:"sales_by_day"`
	ChannelSplit          map[string]int `json:"channel_split"`
	TopProducts           []TopProduct   `json:"top_products"`
	RecentOrders          []Order        `json:"recent_orders"`
	LowStockProducts      []Product      `json:"low_stock_products"`
}

// ---------- Blog ----------

type BlogPost struct {
	ID              string     `json:"id"`
	Title           string     `json:"title"`
	Slug            string     `json:"slug"`
	Excerpt         string     `json:"excerpt"`
	Content         string     `json:"content,omitempty"`
	CoverImage      string     `json:"cover_image"`
	Category        string     `json:"category"`
	Tags            []string   `json:"tags"`
	AuthorName      string     `json:"author_name"`
	Status          string     `json:"status"`
	IsFeatured      bool       `json:"is_featured"`
	PublishedAt     *time.Time `json:"published_at"`
	ReadingMinutes  int        `json:"reading_minutes"`
	ProductCategory string     `json:"product_category"`
	SEOTitle        string     `json:"seo_title"`
	SEODescription  string     `json:"seo_description"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type BlogPostInput struct {
	Title           string     `json:"title"`
	Slug            string     `json:"slug"`
	Excerpt         string     `json:"excerpt"`
	Content         string     `json:"content"`
	CoverImage      string     `json:"cover_image"`
	Category        string     `json:"category"`
	Tags            []string   `json:"tags"`
	AuthorName      string     `json:"author_name"`
	Status          string     `json:"status"`
	IsFeatured      bool       `json:"is_featured"`
	PublishedAt     *time.Time `json:"published_at"`
	ProductCategory string     `json:"product_category"`
	SEOTitle        string     `json:"seo_title"`
	SEODescription  string     `json:"seo_description"`
}

type BlogFilter struct {
	Category string
	Tag      string
	Query    string
	Status   string // admin only: draft | published | scheduled
	Featured bool
	Page     int
	Limit    int
	// Admin listings see drafts and scheduled posts.
	IncludeUnpublished bool
}

type BlogPage struct {
	Items []BlogPost `json:"items"`
	Total int        `json:"total"`
	Page  int        `json:"page"`
	Limit int        `json:"limit"`
}

type BlogCategory struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// ---------- Reviews ----------

type Review struct {
	ID        string    `json:"id"`
	ProductID string    `json:"product_id"`
	Name      string    `json:"name"`
	Rating    int       `json:"rating"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Verified  bool      `json:"verified"`
	CreatedAt time.Time `json:"created_at"`
	// Admin-only fields.
	Email        string `json:"email,omitempty"`
	Status       string `json:"status,omitempty"`
	ProductName  string `json:"product_name,omitempty"`
	ProductSlug  string `json:"product_slug,omitempty"`
	ProductImage string `json:"product_image,omitempty"`
}

type ReviewSummary struct {
	Average   float64     `json:"average"`
	Count     int         `json:"count"`
	Breakdown map[int]int `json:"breakdown"` // stars (1–5) -> number of reviews
}

type ReviewPage struct {
	Items   []Review      `json:"items"`
	Total   int           `json:"total"`
	Page    int           `json:"page"`
	Limit   int           `json:"limit"`
	Summary ReviewSummary `json:"summary"`
}

type ReviewInput struct {
	Name   string `json:"name"`
	Email  string `json:"email"`
	Rating int    `json:"rating"`
	Title  string `json:"title"`
	Body   string `json:"body"`
	// Honeypot: real visitors never fill this hidden field.
	Website string `json:"website"`
}

type ReviewFilter struct {
	Rating int    // 1–5, 0 = all
	Sort   string // newest | highest | lowest
	Page   int
	Limit  int
	// Admin
	Status string
	Query  string
}

// Notification is one customer message (email, SMS or WhatsApp) sent for an
// order event such as "placed", "paid" or "shipped".
type Notification struct {
	ID        string    `json:"id"`
	OrderID   string    `json:"order_id"`
	Event     string    `json:"event"`
	Channel   string    `json:"channel"`
	Recipient string    `json:"recipient"`
	Status    string    `json:"status"`
	Error     string    `json:"error"`
	Attempts  int       `json:"attempts"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ---------- Procurement Models ----------

type Supplier struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	ContactPerson string    `json:"contact_person"`
	Email         string    `json:"email"`
	Phone         string    `json:"phone"`
	Address       string    `json:"address"`
	City          string    `json:"city"`
	Country       string    `json:"country"`
	PaymentTerms  string    `json:"payment_terms"`
	BankDetails   string    `json:"bank_details"`
	LeadTimeDays  int       `json:"lead_time_days"`
	Notes         string    `json:"notes"`
	IsActive      bool      `json:"is_active"`
	POCount       int       `json:"po_count,omitempty"`
	TotalSpent    int64     `json:"total_spent,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type SupplierInput struct {
	Name          string `json:"name"`
	ContactPerson string `json:"contact_person"`
	Email         string `json:"email"`
	Phone         string `json:"phone"`
	Address       string `json:"address"`
	City          string `json:"city"`
	Country       string `json:"country"`
	PaymentTerms  string `json:"payment_terms"`
	BankDetails   string `json:"bank_details"`
	LeadTimeDays  int    `json:"lead_time_days"`
	Notes         string `json:"notes"`
	IsActive      bool   `json:"is_active"`
}

type SupplierFilter struct {
	Query    string
	IsActive *bool
	Page     int
	Limit    int
}

type SupplierPage struct {
	Items []Supplier `json:"items"`
	Total int        `json:"total"`
	Page  int        `json:"page"`
	Limit int        `json:"limit"`
}

type PurchaseOrderItem struct {
	ID               string  `json:"id"`
	PurchaseOrderID  string  `json:"purchase_order_id"`
	ProductID        *string `json:"product_id"`
	ProductName      string  `json:"product_name"`
	SKU              string  `json:"sku"`
	QuantityOrdered  int     `json:"quantity_ordered"`
	QuantityReceived int     `json:"quantity_received"`
	UnitCost         int64   `json:"unit_cost"`
	TotalCost        int64   `json:"total_cost"`
}

type PurchaseOrderItemInput struct {
	ProductID       *string `json:"product_id"`
	ProductName     string  `json:"product_name"`
	SKU             string  `json:"sku"`
	QuantityOrdered int     `json:"quantity_ordered"`
	UnitCost        int64   `json:"unit_cost"`
}

type PurchaseOrder struct {
	ID                   string              `json:"id"`
	PONumber             string              `json:"po_number"`
	SupplierID           string              `json:"supplier_id"`
	SupplierName         string              `json:"supplier_name"`
	Status               string              `json:"status"` // draft, ordered, partially_received, received, cancelled
	PaymentStatus        string              `json:"payment_status"` // unpaid, partially_paid, paid
	Subtotal             int64               `json:"subtotal"`
	ShippingCost         int64               `json:"shipping_cost"`
	CustomsDuty          int64               `json:"customs_duty"`
	OtherCosts           int64               `json:"other_costs"`
	TaxAmount            int64               `json:"tax_amount"`
	TotalCost            int64               `json:"total_cost"`
	AmountPaid           int64               `json:"amount_paid"`
	OrderDate            string              `json:"order_date"`
	ExpectedDeliveryDate string              `json:"expected_delivery_date"`
	ReceivedAt           *time.Time          `json:"received_at"`
	TrackingNumber       string              `json:"tracking_number"`
	ShippingCarrier      string              `json:"shipping_carrier"`
	CreatedBy            *string             `json:"created_by"`
	CreatedByName        string              `json:"created_by_name"`
	Notes                string              `json:"notes"`
	Items                []PurchaseOrderItem `json:"items"`
	Payments             []ProcurementPayment`json:"payments,omitempty"`
	CreatedAt            time.Time           `json:"created_at"`
	UpdatedAt            time.Time           `json:"updated_at"`
}

type PurchaseOrderInput struct {
	SupplierID           string                   `json:"supplier_id"`
	OrderDate            string                   `json:"order_date"`
	ExpectedDeliveryDate string                   `json:"expected_delivery_date"`
	TrackingNumber       string                   `json:"tracking_number"`
	ShippingCarrier      string                   `json:"shipping_carrier"`
	ShippingCost         int64                    `json:"shipping_cost"`
	CustomsDuty          int64                    `json:"customs_duty"`
	OtherCosts           int64                    `json:"other_costs"`
	TaxAmount            int64                    `json:"tax_amount"`
	Notes                string                   `json:"notes"`
	Items                []PurchaseOrderItemInput `json:"items"`
}

type PurchaseOrderFilter struct {
	SupplierID    string
	Status        string
	PaymentStatus string
	Query         string
	Page          int
	Limit         int
}

type PurchaseOrderPage struct {
	Items []PurchaseOrder `json:"items"`
	Total int             `json:"total"`
	Page  int             `json:"page"`
	Limit int             `json:"limit"`
}

type ProcurementPayment struct {
	ID              string    `json:"id"`
	PurchaseOrderID string    `json:"purchase_order_id"`
	Amount          int64     `json:"amount"`
	PaymentMethod   string    `json:"payment_method"`
	Reference       string    `json:"reference"`
	PaidAt          time.Time `json:"paid_at"`
	CreatedByName   string    `json:"created_by_name"`
	Notes           string    `json:"notes"`
}

type ProcurementPaymentInput struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
	Reference     string `json:"reference"`
	Notes         string `json:"notes"`
}

type ReceiveGoodsItem struct {
	ItemID           string `json:"item_id"`
	QuantityReceived int    `json:"quantity_received"`
}

type ReceiveGoodsInput struct {
	Items             []ReceiveGoodsItem `json:"items"`
	UpdateCostPrice   bool               `json:"update_cost_price"` // Whether to update product's cost_price to PO item unit_cost
	Notes             string             `json:"notes"`
}

type ProcurementStats struct {
	TotalSpend           int64 `json:"total_spend"`
	SpendThisMonth       int64 `json:"spend_this_month"`
	PendingPOsCount      int   `json:"pending_pos_count"`
	UnpaidSupplierAmount int64 `json:"unpaid_supplier_amount"`
	ActiveSuppliersCount int   `json:"active_suppliers_count"`
	TotalInventoryCost   int64 `json:"total_inventory_cost"`
	TotalInventoryRetail int64 `json:"total_inventory_retail"`
}
