// Package notify sends customers their order link and status updates by
// email, SMS and WhatsApp, so they can track an order from any device.
// Each channel switches on when its credentials are configured.
package notify

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"chrismoore-decor/backend/internal/models"
	"chrismoore-decor/backend/internal/whatsapp"
)

// Order events that send a customer message.
const (
	EventPlaced    = "placed"
	EventPaid      = "paid"
	EventConfirmed = "confirmed"
	EventShipped   = "shipped"
	EventDelivered = "delivered"
	EventCancelled = "cancelled"
)

// Events lists every event in lifecycle order.
var Events = []string{EventPlaced, EventPaid, EventConfirmed, EventShipped, EventDelivered, EventCancelled}

// StatusEvent maps a fulfilment status to the event it announces. Statuses
// customers don't need a message for (pending, processing) return "".
func StatusEvent(status string) string {
	switch status {
	case "confirmed", "shipped", "delivered", "cancelled":
		return status
	}
	return ""
}

// StoreInfo is the contact block shown in messages.
type StoreInfo struct {
	Name     string
	Phone    string
	WhatsApp string // international digits, e.g. 2347039630895
	Email    string
}

// Update is everything a channel needs to render one message.
type Update struct {
	Order    models.Order
	Event    string
	OrderURL string
	Store    StoreInfo
}

// FirstName is the customer's first name, for greetings.
func (u Update) FirstName() string {
	if f := strings.Fields(u.Order.CustomerName); len(f) > 0 {
		return f[0]
	}
	return "there"
}

// Headline is a short title for the event, used as the email heading.
func (u Update) Headline() string {
	switch u.Event {
	case EventPlaced:
		return "We've received your order"
	case EventPaid:
		return "Payment received"
	case EventConfirmed:
		return "Your order is confirmed"
	case EventShipped:
		return "Your order is on its way"
	case EventDelivered:
		return "Your order has been delivered"
	case EventCancelled:
		return "Your order was cancelled"
	}
	return "Order update"
}

// awaitingOnlinePayment is true for an unpaid Paystack/Flutterwave order,
// which is held for 3 hours before its stock is released.
func (u Update) awaitingOnlinePayment() bool {
	return u.Order.Channel != "whatsapp" && u.Order.PaymentStatus != "paid"
}

// Sentence is one line describing the event. It has no line breaks (a
// WhatsApp template parameter can't contain them) and sticks to plain
// characters so an SMS stays in as few parts as possible.
func (u Update) Sentence() string {
	switch u.Event {
	case EventPlaced:
		if u.awaitingOnlinePayment() {
			return "we've reserved your items. Please complete payment within 3 hours to keep them."
		}
		return "we've received your order and will confirm it with you on WhatsApp shortly."
	case EventPaid:
		return fmt.Sprintf("we've received your payment of %s. We'll start preparing your order.", PlainNaira(u.Order.Total))
	case EventConfirmed:
		return "your order has been confirmed and is being prepared."
	case EventShipped:
		return "your order is on its way to you."
	case EventDelivered:
		return "your order has been delivered. Thank you for shopping with us!"
	case EventCancelled:
		if u.awaitingOnlinePayment() {
			return "your order was cancelled because payment wasn't completed. You're welcome to order again any time."
		}
		return "your order has been cancelled. Please contact us if you have any questions."
	}
	return "there's an update on your order."
}

// Subject is the email subject line.
func (u Update) Subject() string {
	return fmt.Sprintf("%s · %s", u.Headline(), u.Order.Reference)
}

// PlainNaira formats kobo for SMS and WhatsApp parameters ("NGN 85,000"):
// the ₦ sign would force an SMS into the shorter Unicode encoding.
func PlainNaira(kobo int64) string {
	return "NGN " + strings.TrimPrefix(whatsapp.Naira(kobo), "₦")
}

// Channel delivers an Update to one customer contact.
type Channel interface {
	Name() string // "email", "sms" or "whatsapp"
	Enabled() bool
	// Recipient is the address for this order, or "" when the order has none.
	Recipient(o models.Order) string
	Send(ctx context.Context, to string, u Update) error
}

// Recorder stores one row per order, event and channel so a message is
// never sent twice. *store.Store implements it.
type Recorder interface {
	ClaimNotification(ctx context.Context, orderID, event, channel, recipient string, force bool) (string, bool, error)
	FinishNotification(ctx context.Context, id string, sendErr error) error
}

// Service fans an order event out to every enabled channel.
type Service struct {
	Recorder Recorder
	Channels []Channel
	// StoreInfo loads the store's current contact details.
	StoreInfo func(ctx context.Context) StoreInfo
	// OrderURL builds the customer's tracking link for a reference.
	OrderURL func(reference string) string

	wg sync.WaitGroup
}

// Enabled reports whether at least one channel is configured.
func (s *Service) Enabled() bool { return len(s.Active()) > 0 }

// Active lists the names of the configured channels.
func (s *Service) Active() []string {
	var out []string
	for _, c := range s.Channels {
		if c.Enabled() {
			out = append(out, c.Name())
		}
	}
	return out
}

// Has reports whether the named channel is configured.
func (s *Service) Has(name string) bool {
	for _, c := range s.Channels {
		if c.Name() == name && c.Enabled() {
			return true
		}
	}
	return false
}

// Notify sends the event in the background, so a slow mail server or SMS
// gateway never holds up checkout or the dashboard.
func (s *Service) Notify(o models.Order, event string) {
	if event == "" || !s.Enabled() {
		return
	}
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
		defer cancel()
		s.Send(ctx, o, event, false)
	}()
}

// Wait blocks until background sends finish, or the timeout passes.
func (s *Service) Wait(timeout time.Duration) {
	done := make(chan struct{})
	go func() { s.wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(timeout):
	}
}

// Send delivers the event on every enabled channel and waits for the
// results. With force, a message that was already sent goes out again
// (a manual resend). Failures are recorded and logged, not returned.
func (s *Service) Send(ctx context.Context, o models.Order, event string, force bool) {
	u := Update{Order: o, Event: event}
	if s.OrderURL != nil {
		u.OrderURL = s.OrderURL(o.Reference)
	}
	if s.StoreInfo != nil {
		u.Store = s.StoreInfo(ctx)
	}
	if u.Store.Name == "" {
		u.Store.Name = "Chris Moore Interior Decor"
	}
	var wg sync.WaitGroup
	for _, c := range s.Channels {
		if !c.Enabled() {
			continue
		}
		to := c.Recipient(o)
		if to == "" {
			continue
		}
		id, ok, err := s.Recorder.ClaimNotification(ctx, o.ID, event, c.Name(), to, force)
		if err != nil {
			log.Printf("notify %s %s via %s: %v", o.Reference, event, c.Name(), err)
			continue
		}
		if !ok {
			continue // already sent
		}
		wg.Add(1)
		go func(c Channel, id, to string) {
			defer wg.Done()
			sendErr := c.Send(ctx, to, u)
			if sendErr != nil {
				log.Printf("notify %s %s via %s: %v", o.Reference, event, c.Name(), sendErr)
			}
			// Record the result even if the request context has ended.
			rctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := s.Recorder.FinishNotification(rctx, id, sendErr); err != nil {
				log.Printf("notify %s: record result: %v", o.Reference, err)
			}
		}(c, id, to)
	}
	wg.Wait()
}

// oneLine collapses whitespace: WhatsApp template parameters reject new
// lines, tabs and runs of spaces.
func oneLine(s string) string { return strings.Join(strings.Fields(s), " ") }
