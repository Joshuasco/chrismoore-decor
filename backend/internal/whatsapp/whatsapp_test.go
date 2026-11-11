package whatsapp

import (
	"net/url"
	"strings"
	"testing"

	"chrismoore-decor/backend/internal/models"
)

func TestNaira(t *testing.T) {
	cases := map[int64]string{0: "₦0", 50000: "₦500", 8500000: "₦85,000", 1234567800: "₦12,345,678", 150: "₦1.50"}
	for in, want := range cases {
		if got := Naira(in); got != want {
			t.Errorf("Naira(%d) = %q, want %q", in, got, want)
		}
	}
}

func TestChatLink(t *testing.T) {
	o := models.Order{Reference: "CM-ABC", CustomerName: "Ada", Phone: "0803", Address: "1 Allen Ave", City: "Ikeja", State: "Lagos",
		Subtotal: 8500000, ShippingFee: 500000, Total: 9000000,
		Items: []models.OrderItem{{ProductName: "Sahara Curtains", Quantity: 1, UnitPrice: 8500000, Color: "Sand", Size: "140 x 230 cm"}}}
	link := ChatLink("+234 800 000 0000", OrderMessage(o, "https://shop/order/CM-ABC"))
	if !strings.HasPrefix(link, "https://wa.me/2348000000000?text=") {
		t.Fatalf("bad link prefix: %s", link)
	}
	u, _ := url.Parse(link)
	msg := u.Query().Get("text")
	for _, want := range []string{"CM-ABC", "Sahara Curtains (Sand, 140 x 230 cm)", "*Total: ₦90,000*", "Ikeja, Lagos", "https://shop/order/CM-ABC"} {
		if !strings.Contains(msg, want) {
			t.Errorf("message missing %q:\n%s", want, msg)
		}
	}
}
