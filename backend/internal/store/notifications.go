package store

import (
	"context"

	"chrismoore-decor/backend/internal/models"

	"github.com/jackc/pgx/v5"
)

// ClaimNotification reserves the right to send one order event on one
// channel. It returns ok=false when that message was already sent (or is
// being sent), so the same update never reaches the customer twice. With
// force (a manual resend from the dashboard) an existing row is reused,
// unless another send is still in flight.
func (s *Store) ClaimNotification(ctx context.Context, orderID, event, channel, recipient string, force bool) (string, bool, error) {
	var id string
	err := s.db.QueryRow(ctx, `insert into order_notifications (order_id, event, channel, recipient)
		values ($1,$2,$3,$4) on conflict (order_id, event, channel) do nothing returning id`,
		orderID, event, channel, recipient).Scan(&id)
	if err == nil {
		return id, true, nil
	}
	if err != pgx.ErrNoRows {
		return "", false, mapErr(err)
	}
	if !force {
		return "", false, nil
	}
	err = s.db.QueryRow(ctx, `update order_notifications
		set status='sending', error='', recipient=$4, attempts=attempts+1, updated_at=now()
		where order_id=$1 and event=$2 and channel=$3
		  and (status <> 'sending' or updated_at < now() - interval '5 minutes')
		returning id`, orderID, event, channel, recipient).Scan(&id)
	if err == pgx.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, mapErr(err)
	}
	return id, true, nil
}

// FinishNotification records whether a claimed message was delivered to the
// provider.
func (s *Store) FinishNotification(ctx context.Context, id string, sendErr error) error {
	status, msg := "sent", ""
	if sendErr != nil {
		status, msg = "failed", sendErr.Error()
		if len(msg) > 500 {
			msg = msg[:500]
		}
	}
	_, err := s.db.Exec(ctx, `update order_notifications set status=$2, error=$3, updated_at=now() where id=$1`, id, status, msg)
	return mapErr(err)
}

func (s *Store) ListNotifications(ctx context.Context, orderID string) ([]models.Notification, error) {
	rows, err := s.db.Query(ctx, `select id, order_id, event, channel, recipient, status, error, attempts, created_at, updated_at
		from order_notifications where order_id=$1 order by created_at, channel`, orderID)
	if err != nil {
		return nil, mapErr(err)
	}
	list, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (models.Notification, error) {
		var n models.Notification
		err := r.Scan(&n.ID, &n.OrderID, &n.Event, &n.Channel, &n.Recipient, &n.Status, &n.Error, &n.Attempts, &n.CreatedAt, &n.UpdatedAt)
		return n, err
	})
	if list == nil {
		list = []models.Notification{}
	}
	return list, mapErr(err)
}
