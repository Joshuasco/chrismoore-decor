"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import type { Invoice, Order } from "@/lib/types";

export default function PaymentCallback({
  reference,
  order: orderRef,
  invoice: invoiceToken,
  status,
}: {
  reference: string;
  order: string;
  invoice: string;
  status: string;
}) {
  const [state, setState] = useState<"checking" | "paid" | "unpaid" | "error">(reference ? "checking" : "error");
  const [order, setOrder] = useState<Order | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [message, setMessage] = useState(reference ? "" : "Missing payment reference.");

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    apiFetch<{ verified: boolean; order?: Order; invoice?: Invoice }>(`/api/payments/verify?reference=${encodeURIComponent(reference)}`)
      .then((res) => {
        if (cancelled) return;
        setOrder(res.order ?? null);
        setInvoice(res.invoice ?? null);
        setState(res.verified ? "paid" : "unpaid");
      })
      .catch((e) => {
        if (cancelled) return;
        setMessage(e.message);
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reference]);

  const ref = order?.reference || orderRef;
  const invToken = invoice?.token || invoiceToken;

  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      {state === "checking" && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-bronze" />
          <h1 className="heading mt-6 text-4xl">Confirming your payment…</h1>
          <p className="mt-2 text-sm text-stone">Please don&apos;t close this page.</p>
        </>
      )}
      {state === "paid" && order && (
        <>
          <CheckCircle2 className="h-14 w-14 text-whatsapp" />
          <h1 className="heading mt-6 text-4xl sm:text-5xl">Payment successful</h1>
          <p className="mt-3 max-w-md text-sm text-stone">
            Thank you, {order.customer_name.split(" ")[0]}! We&apos;ve received {formatNaira(order.total)} for order {order.reference}. We&apos;ll
            contact you shortly about delivery.
          </p>
          <Link href={`/order/${order.reference}`} className="btn-primary mt-8 px-8">View order</Link>
        </>
      )}
      {state === "paid" && invoice && (
        <>
          <CheckCircle2 className="h-14 w-14 text-whatsapp" />
          <h1 className="heading mt-6 text-4xl sm:text-5xl">Payment successful</h1>
          <p className="mt-3 max-w-md text-sm text-stone">
            Thank you, {invoice.customer_name.split(" ")[0]}! We&apos;ve received {formatNaira(invoice.total)} for invoice {invoice.number}. Your
            invoice now shows as paid. You can download it as your receipt.
          </p>
          <Link href={`/invoice/${invoice.token}`} className="btn-primary mt-8 px-8">View receipt</Link>
        </>
      )}
      {(state === "unpaid" || state === "error") && invToken && !ref && (
        <>
          <XCircle className="h-14 w-14 text-red-700" />
          <h1 className="heading mt-6 text-4xl">{status === "cancelled" ? "Payment cancelled" : "Payment not completed"}</h1>
          <p className="mt-3 max-w-md text-sm text-stone">{message || "Your payment wasn't completed. You can try again from your invoice."}</p>
          <Link href={`/invoice/${invToken}`} className="btn-primary mt-8 px-8">Back to invoice</Link>
        </>
      )}
      {(state === "unpaid" || state === "error") && !(invToken && !ref) && (
        <>
          <XCircle className="h-14 w-14 text-red-700" />
          <h1 className="heading mt-6 text-4xl">{status === "cancelled" ? "Payment cancelled" : "Payment not completed"}</h1>
          <p className="mt-3 max-w-md text-sm text-stone">
            {message || "Your payment wasn't completed. Your order is saved — you can try again or finish on WhatsApp."}
          </p>
          {ref && <Link href={`/order/${ref}`} className="btn-primary mt-8 px-8">Back to order</Link>}
        </>
      )}
    </div>
  );
}
