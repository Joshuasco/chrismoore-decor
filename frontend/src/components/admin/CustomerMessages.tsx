"use client";

import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { AlertCircle, CheckCircle2, Clock, Loader2, Mail, MessageSquareText, Send } from "lucide-react";
import { WhatsAppIcon } from "@/components/store/WhatsAppFab";
import { adminFetch } from "@/lib/admin";
import { cn, formatDate } from "@/lib/format";
import type { NotificationEvent, Order, OrderNotification } from "@/lib/types";

const EVENTS: { id: NotificationEvent; label: string }[] = [
  { id: "placed", label: "Order received" },
  { id: "paid", label: "Payment received" },
  { id: "confirmed", label: "Order confirmed" },
  { id: "shipped", label: "On its way" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];
const EVENT_LABEL = Object.fromEntries(EVENTS.map((e) => [e.id, e.label])) as Record<string, string>;

const CHANNEL = {
  email: { label: "Email", icon: Mail },
  sms: { label: "SMS", icon: MessageSquareText },
  whatsapp: { label: "WhatsApp", icon: WhatsAppIcon },
} as const;

/** The update that best matches the order's current state, for "Resend". */
function defaultEvent(o: Order): NotificationEvent {
  if (o.status === "cancelled") return "cancelled";
  if (o.status === "delivered") return "delivered";
  if (o.status === "shipped") return "shipped";
  if (o.payment_status === "paid") return "paid";
  if (o.status === "confirmed" || o.status === "processing") return "confirmed";
  return "placed";
}

export default function CustomerMessages({
  order,
  channels,
  notifications,
  onChange,
}: {
  order: Order;
  channels: string[];
  notifications: OrderNotification[];
  onChange: (n: OrderNotification[]) => void;
}) {
  const [event, setEvent] = useState<NotificationEvent>(() => defaultEvent(order));
  const [sending, setSending] = useState(false);

  if (channels.length === 0) {
    return (
      <p className="p-5 text-sm text-stone">
        Customers aren&apos;t sent their order link yet. Set up email, SMS or WhatsApp on the API server to send it automatically, with
        updates when the order is paid, confirmed, shipped, delivered or cancelled.{" "}
        <Link href="/admin/settings" className="text-bronze hover:underline">See integrations</Link>
      </p>
    );
  }

  const resend = async () => {
    setSending(true);
    try {
      const r = await adminFetch<{ notifications: OrderNotification[] }>(`/orders/${order.id}/notify`, {
        method: "POST",
        body: JSON.stringify({ event }),
      });
      onChange(r.notifications);
      const latest = r.notifications.filter((n) => n.event === event);
      const failed = latest.filter((n) => n.status === "failed");
      if (latest.length === 0) toast.error("Nothing was sent: the order has no email or phone for the configured channels");
      else if (failed.length === latest.length) toast.error("Sending failed, see the error below");
      else if (failed.length) toast(`Sent, but ${failed.map((n) => CHANNEL[n.channel].label).join(", ")} failed`, { icon: "⚠️" });
      else toast.success(`“${EVENT_LABEL[event]}” sent`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  // Group rows by event, in lifecycle order.
  const byEvent = EVENTS.map((e) => ({ ...e, rows: notifications.filter((n) => n.event === e.id) })).filter((g) => g.rows.length);

  return (
    <div className="text-sm">
      {byEvent.length === 0 ? (
        <p className="px-5 pt-4 text-stone">No messages sent for this order yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {byEvent.map((g) => (
            <li key={g.id} className="px-5 py-3">
              <p className="font-medium">{g.label}</p>
              <ul className="mt-1.5 space-y-1.5">
                {g.rows.map((n) => {
                  const C = CHANNEL[n.channel];
                  return (
                    <li key={n.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <C.icon className="h-3.5 w-3.5 shrink-0 text-stone" />
                        <span className="min-w-0 flex-1 truncate text-stone" title={n.recipient}>{C.label} · {n.recipient}</span>
                        <span
                          className={cn(
                            "flex shrink-0 items-center gap-1",
                            n.status === "sent" && "text-emerald-700",
                            n.status === "failed" && "text-red-700",
                            n.status === "sending" && "text-mist",
                          )}
                          title={formatDate(n.updated_at, true)}
                        >
                          {n.status === "sent" ? <CheckCircle2 className="h-3.5 w-3.5" /> : n.status === "failed" ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                          {n.status === "sent" ? "Sent" : n.status === "failed" ? "Failed" : "Sending"}
                          {n.attempts > 1 && ` ×${n.attempts}`}
                        </span>
                      </div>
                      {n.status === "failed" && n.error && <p className="mt-1 break-words rounded bg-red-50 px-2 py-1 text-red-800">{n.error}</p>}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 border-t border-line p-4">
        <label htmlFor="notify-event" className="sr-only">Message to send</label>
        <select id="notify-event" className="input py-2 text-xs" value={event} onChange={(e) => setEvent(e.target.value as NotificationEvent)} disabled={sending}>
          {EVENTS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
        <button onClick={resend} disabled={sending} className="btn-outline btn-sm shrink-0">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
        </button>
      </div>
      <p className="px-4 pb-4 text-xs text-mist">Sent automatically on each update via {channels.map((c) => CHANNEL[c as keyof typeof CHANNEL]?.label ?? c).join(", ")}. Use Send to resend one.</p>
    </div>
  );
}
