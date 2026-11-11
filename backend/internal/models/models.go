package models

import "time"

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
	OrderID   string `json:"order_id"`
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
	OrderRef    *string   `json:"order_reference"`
	Actor       string    `json:"actor"`
	CreatedAt   time.Time `json:"created_at"`
}

type AdminUser struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	Role         string    `json:"role"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

type DailySales struct {
	Day     string `json:"day"`
	Revenue int64  `json:"revenue"`
	Orders  int    `json:"orders"`
}

type TopProduct struct {
	ProductID string `json:"product_id"`
	Name      string `json:"name"`
	ImageURL  string `json:"image_url"`
	Units     int    `json:"units"`
	Revenue   int64  `json:"revenue"`
}

type DashboardStats struct {
	Revenue          int64          `json:"revenue"`
	RevenueThisMonth int64          `json:"revenue_this_month"`
	OrdersTotal      int            `json:"orders_total"`
	OrdersPending    int            `json:"orders_pending"`
	OrdersToday      int            `json:"orders_today"`
	ProductsActive   int            `json:"products_active"`
	LowStock         int            `json:"low_stock"`
	OutOfStock       int            `json:"out_of_stock"`
	InventoryValue   int64          `json:"inventory_value"`
	Subscribers      int            `json:"subscribers"`
	ReviewsPending   int            `json:"reviews_pending"`
	SalesByDay       []DailySales   `json:"sales_by_day"`
	ChannelSplit     map[string]int `json:"channel_split"`
	TopProducts      []TopProduct   `json:"top_products"`
	RecentOrders     []Order        `json:"recent_orders"`
	LowStockProducts []Product      `json:"low_stock_products"`
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
