package api

import (
	"testing"

	"chrismoore-decor/backend/internal/models"
)

func TestValidateCheckout(t *testing.T) {
	good := func() models.CheckoutRequest {
		return models.CheckoutRequest{CustomerName: " Ada ", Email: "ADA@Example.com", Phone: "0803 123 4567", Address: "1 Allen Ave",
			Channel: "whatsapp", Items: []models.CheckoutItem{{ProductID: "x", Quantity: 1}}}
	}
	r := good()
	if err := validateCheckout(&r); err != nil {
		t.Fatalf("valid request rejected: %v", err)
	}
	if r.Email != "ada@example.com" || r.CustomerName != "Ada" {
		t.Fatalf("not normalised: %+v", r)
	}
	bad := []func(*models.CheckoutRequest){
		func(r *models.CheckoutRequest) { r.CustomerName = "" },
		func(r *models.CheckoutRequest) { r.Phone = "123" },
		func(r *models.CheckoutRequest) { r.Email = "nope" },
		func(r *models.CheckoutRequest) { r.Email = "Ada <ada@example.com>" }, // must be a bare address
		func(r *models.CheckoutRequest) { r.Channel = "cash" },
		func(r *models.CheckoutRequest) { r.Items = nil },
		func(r *models.CheckoutRequest) { r.Items[0].Quantity = 0 },
	}
	for i, mut := range bad {
		r := good()
		mut(&r)
		if validateCheckout(&r) == nil {
			t.Errorf("case %d: expected validation error", i)
		}
	}
}
