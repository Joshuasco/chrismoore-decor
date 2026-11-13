import Logo from "@/components/store/Logo";
import { cn, formatDate, formatNaira } from "@/lib/format";
import type { Invoice, StoreSettings } from "@/lib/types";

/** Formats a YYYY-MM-DD date without shifting it across time zones. */
export function formatDueDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function invoiceState(inv: Invoice): "paid" | "void" | "overdue" | "unpaid" {
  if (inv.status === "unpaid" && inv.overdue) return "overdue";
  return inv.status;
}

const STAMP: Record<string, string> = {
  paid: "border-emerald-600 text-emerald-700",
  void: "border-stone-400 text-stone-500",
  overdue: "border-red-600 text-red-700",
};

/** The printable invoice, shared by the customer page and the admin preview. */
export default function InvoiceDocument({ invoice: inv, settings }: { invoice: Invoice; settings: StoreSettings }) {
  const state = invoiceState(inv);
  const storeName = settings.store_name || "Chris Moore Interior Decor";
  return (
    <article className="relative overflow-hidden rounded-xl border border-line bg-white p-6 sm:p-10 print:rounded-none print:border-0 print:p-0">
      {state !== "unpaid" && (
        <span
          className={cn(
            "absolute right-6 top-24 rotate-[-12deg] rounded-md border-[3px] px-4 py-1 text-xl font-bold uppercase tracking-[0.2em] opacity-80 sm:right-10 sm:top-10",
            STAMP[state],
          )}
          aria-label={`Status: ${state}`}
        >
          {state}
        </span>
      )}
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <Logo />
          <div className="mt-4 max-w-xs space-y-0.5 text-xs leading-relaxed text-stone">
            {settings.address && <p>{settings.address}</p>}
            {settings.contact_phone && <p>{settings.contact_phone}</p>}
            {settings.contact_email && <p>{settings.contact_email}</p>}
          </div>
        </div>
        <div className="text-left sm:text-right">
          <h1 className="font-serif text-4xl font-semibold tracking-wide">Invoice</h1>
          <p className="mt-1 text-sm font-medium tracking-wider">{inv.number}</p>
          <dl className="mt-3 space-y-0.5 text-xs text-stone">
            <div><dt className="inline">Issued: </dt><dd className="inline text-ink">{formatDate(inv.created_at)}</dd></div>
            {inv.due_date && (
              <div><dt className="inline">Due: </dt><dd className={cn("inline", state === "overdue" ? "font-medium text-red-700" : "text-ink")}>{formatDueDate(inv.due_date)}</dd></div>
            )}
            {inv.paid_at && <div><dt className="inline">Paid: </dt><dd className="inline text-ink">{formatDate(inv.paid_at)}</dd></div>}
          </dl>
        </div>
      </header>

      <section className="mt-8 rounded-lg bg-cream/60 p-4 text-sm print:bg-transparent print:p-0">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mist">Bill to</p>
        <p className="mt-1 font-medium">{inv.customer_name}</p>
        {inv.address && <p className="whitespace-pre-line text-stone">{inv.address}</p>}
        <p className="text-stone">{[inv.phone, inv.email].filter(Boolean).join(" · ")}</p>
      </section>

      <div className="mt-6">
        <table className="w-full text-sm">
          <thead className="border-b border-ink/80 text-left text-[11px] uppercase tracking-[0.14em] text-stone">
            <tr>
              <th className="py-2.5 pr-3 font-medium">Description</th>
              <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell print:table-cell">Qty</th>
              <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell print:table-cell">Unit price</th>
              <th className="py-2.5 pl-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {inv.items.map((it) => (
              <tr key={it.id}>
                <td className="py-3 pr-3">
                  {it.description}
                  {/* On phones the quantity and unit price sit under the description. */}
                  <span className="mt-0.5 block text-xs text-stone sm:hidden print:hidden">
                    {it.quantity} × {formatNaira(it.unit_price)}
                  </span>
                </td>
                <td className="hidden px-3 py-3 text-right sm:table-cell print:table-cell">{it.quantity}</td>
                <td className="hidden whitespace-nowrap px-3 py-3 text-right sm:table-cell print:table-cell">{formatNaira(it.unit_price)}</td>
                <td className="whitespace-nowrap py-3 pl-3 text-right font-medium">{formatNaira(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto mt-4 max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between"><dt className="text-stone">Subtotal</dt><dd>{formatNaira(inv.subtotal)}</dd></div>
        {inv.discount > 0 && <div className="flex justify-between"><dt className="text-stone">Discount</dt><dd>−{formatNaira(inv.discount)}</dd></div>}
        {inv.tax_rate > 0 && <div className="flex justify-between"><dt className="text-stone">VAT ({inv.tax_rate}%)</dt><dd>{formatNaira(inv.tax)}</dd></div>}
        {inv.delivery_fee > 0 && <div className="flex justify-between"><dt className="text-stone">Delivery</dt><dd>{formatNaira(inv.delivery_fee)}</dd></div>}
        <div className="flex justify-between border-t border-ink/80 pt-2 text-base font-semibold"><dt>{inv.status === "paid" ? "Total paid" : "Total due"}</dt><dd>{formatNaira(inv.total)}</dd></div>
      </dl>

      {inv.notes && (
        <section className="mt-8 border-t border-line pt-4 text-sm">
          <p className="text-[11px] uppercase tracking-[0.18em] text-mist">Notes</p>
          <p className="mt-1 whitespace-pre-line text-stone">{inv.notes}</p>
        </section>
      )}
      <p className="mt-10 text-center text-xs text-mist">Thank you for choosing {storeName}.</p>
    </article>
  );
}
