"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Panel } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";
import { formatNaira } from "@/lib/format";
import type { Invoice, InvoiceDetail, Product } from "@/lib/types";

type Row = { key: number; product_id: string; description: string; quantity: string; unit_price: string };

let nextKey = 1;
const blankRow = (): Row => ({ key: nextKey++, product_id: "", description: "", quantity: "1", unit_price: "" });

/** "₦" amounts typed by the admin → kobo. */
const toKobo = (naira: string) => Math.round((Number(naira.replace(/,/g, "")) || 0) * 100);
const toNaira = (kobo: number) => (kobo ? String(kobo / 100) : "");

/** Mirrors the server's invoice maths (backend store.InvoiceTotals). */
export function invoiceTotals(rows: { quantity: number; unit_price: number }[], discount: number, delivery: number, taxRate: number) {
  const subtotal = rows.reduce((s, r) => s + r.quantity * r.unit_price, 0);
  const taxable = Math.max(subtotal - discount, 0);
  const tax = Math.round((taxable * Math.round(taxRate * 100)) / 10000);
  return { subtotal, tax, total: taxable + tax + delivery };
}

export default function InvoiceForm({ initial, onSaved }: { initial?: Invoice; onSaved: (d: InvoiceDetail) => void }) {
  const [customer, setCustomer] = useState({
    customer_name: initial?.customer_name ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    address: initial?.address ?? "",
  });
  const [rows, setRows] = useState<Row[]>(() =>
    initial?.items.length
      ? initial.items.map((it) => ({
          key: nextKey++,
          product_id: it.product_id ?? "",
          description: it.description,
          quantity: String(it.quantity),
          unit_price: toNaira(it.unit_price),
        }))
      : [blankRow()],
  );
  const [extra, setExtra] = useState({
    discount: toNaira(initial?.discount ?? 0),
    delivery_fee: toNaira(initial?.delivery_fee ?? 0),
    tax_rate: initial?.tax_rate ? String(initial.tax_rate) : "",
    due_date: initial?.due_date ?? "",
    notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  // Catalogue search: pick a product to add it as a line with its price.
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => {
      adminFetch<{ items: Product[] }>(`/products?q=${encodeURIComponent(q.trim())}&limit=8`)
        .then((r) => setResults(r.items))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setResults([]);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const addProduct = (p: Product) => {
    const row: Row = { key: nextKey++, product_id: p.id, description: p.name, quantity: "1", unit_price: toNaira(p.price) };
    // Replace the first empty row rather than leaving a blank line above.
    setRows((rs) => {
      const i = rs.findIndex((r) => !r.description.trim() && !r.unit_price);
      return i >= 0 ? rs.map((r, j) => (j === i ? row : r)) : [...rs, row];
    });
    setQ("");
    setResults([]);
  };

  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const parsed = rows.map((r) => ({ quantity: Math.max(0, Math.floor(Number(r.quantity) || 0)), unit_price: toKobo(r.unit_price) }));
  const discount = toKobo(extra.discount);
  const delivery = toKobo(extra.delivery_fee);
  const taxRate = Number(extra.tax_rate) || 0;
  const totals = invoiceTotals(parsed, discount, delivery, taxRate);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = rows
      .filter((r) => r.description.trim() || r.unit_price)
      .map((r) => ({
        product_id: r.product_id,
        description: r.description,
        quantity: Math.floor(Number(r.quantity) || 0),
        unit_price: toKobo(r.unit_price),
      }));
    setSaving(true);
    try {
      const body = JSON.stringify({ ...customer, ...extra, discount, delivery_fee: delivery, tax_rate: taxRate, items });
      const d = await adminFetch<InvoiceDetail>(initial?.id ? `/invoices/${initial.id}` : "/invoices", {
        method: initial?.id ? "PUT" : "POST",
        body,
      });
      onSaved(d);
    } catch (err) {
      toast.error((err as Error).message);
      setSaving(false);
    }
  };

  const setC = (k: keyof typeof customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCustomer({ ...customer, [k]: e.target.value });
  const setX = (k: keyof typeof extra) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setExtra({ ...extra, [k]: e.target.value });

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        <Panel title="Customer">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="customer_name">Customer name</label>
              <input id="customer_name" required className="input" value={customer.customer_name} onChange={setC("customer_name")} />
            </div>
            <div>
              <label className="label" htmlFor="phone">Phone (for WhatsApp)</label>
              <input id="phone" type="tel" className="input" placeholder="0803 123 4567" value={customer.phone} onChange={setC("phone")} />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" className="input" value={customer.email} onChange={setC("email")} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="address">Address (optional)</label>
              <textarea id="address" rows={2} className="input" value={customer.address} onChange={setC("address")} />
            </div>
          </div>
        </Panel>

        <Panel title="Items">
          <div className="border-b border-line p-4" ref={searchRef}>
            <div className="relative">
              <div className="flex items-center gap-2 rounded-md border border-line px-3">
                <Search className="h-4 w-4 text-mist" />
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    if (!e.target.value.trim()) setResults([]);
                  }}
                  placeholder="Add a product from the catalogue…"
                  aria-label="Search products"
                  className="w-full py-2 text-sm outline-none"
                />
              </div>
              {results.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-line bg-white py-1 shadow-lift">
                  {results.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => addProduct(p)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-cream">
                        <span>
                          {p.name} <span className="text-xs text-mist">{p.sku}</span>
                        </span>
                        <span className="shrink-0 text-right text-stone">
                          {formatNaira(p.price)}
                          <span className={p.stock > 0 ? "block text-[11px] text-mist" : "block text-[11px] text-red-700"}>
                            {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-1.5 text-xs text-mist">Catalogue products are reserved from stock when you save; voiding or deleting the invoice puts them back. Typed items or services (e.g. installation) don&apos;t affect stock.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-cream/60 text-left text-xs text-stone">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="w-24 px-2 py-2.5 font-medium">Qty</th>
                  <th className="w-40 px-2 py-2.5 font-medium">Unit price (₦)</th>
                  <th className="w-32 px-2 py-2.5 text-right font-medium">Amount</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r, i) => (
                  <tr key={r.key}>
                    <td className="px-4 py-2">
                      <input
                        aria-label={`Item ${i + 1} description`}
                        className="input py-2"
                        value={r.description}
                        onChange={(e) => setRow(r.key, { description: e.target.value })}
                        placeholder="Item or service"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input aria-label={`Item ${i + 1} quantity`} type="number" min={1} step={1} className="input py-2" value={r.quantity} onChange={(e) => setRow(r.key, { quantity: e.target.value })} />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Item ${i + 1} unit price in naira`}
                        type="number"
                        min={0}
                        step="0.01"
                        className="input py-2"
                        value={r.unit_price}
                        onChange={(e) => setRow(r.key, { unit_price: e.target.value })}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-medium">{formatNaira(parsed[i].quantity * parsed[i].unit_price)}</td>
                    <td className="pr-3">
                      <button
                        type="button"
                        onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [blankRow()]))}
                        className="rounded p-1.5 text-mist hover:bg-red-50 hover:text-red-700"
                        aria-label={`Remove item ${i + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line p-3">
            <button type="button" onClick={() => setRows((rs) => [...rs, blankRow()])} className="btn-outline btn-sm">
              <Plus className="h-4 w-4" /> Add line
            </button>
          </div>
        </Panel>

        <Panel title="Notes (shown on the invoice)">
          <div className="p-5">
            <textarea
              aria-label="Notes"
              rows={3}
              maxLength={2000}
              className="input"
              placeholder="e.g. Bank transfer details, delivery timeline, measurements…"
              value={extra.notes}
              onChange={setX("notes")}
            />
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Totals">
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="discount">Discount (₦)</label>
                <input id="discount" type="number" min={0} step="0.01" className="input" value={extra.discount} onChange={setX("discount")} placeholder="0" />
              </div>
              <div>
                <label className="label" htmlFor="delivery_fee">Delivery (₦)</label>
                <input id="delivery_fee" type="number" min={0} step="0.01" className="input" value={extra.delivery_fee} onChange={setX("delivery_fee")} placeholder="0" />
              </div>
              <div>
                <label className="label" htmlFor="tax_rate">VAT (%)</label>
                <input id="tax_rate" type="number" min={0} max={100} step="0.01" className="input" value={extra.tax_rate} onChange={setX("tax_rate")} placeholder="e.g. 7.5" />
              </div>
              <div>
                <label className="label" htmlFor="due_date">Due date</label>
                <input id="due_date" type="date" className="input" value={extra.due_date} onChange={setX("due_date")} />
              </div>
            </div>
            <dl className="space-y-1.5 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-stone">Subtotal</dt><dd>{formatNaira(totals.subtotal)}</dd></div>
              {discount > 0 && <div className="flex justify-between"><dt className="text-stone">Discount</dt><dd>−{formatNaira(discount)}</dd></div>}
              {taxRate > 0 && <div className="flex justify-between"><dt className="text-stone">VAT ({taxRate}%)</dt><dd>{formatNaira(totals.tax)}</dd></div>}
              {delivery > 0 && <div className="flex justify-between"><dt className="text-stone">Delivery</dt><dd>{formatNaira(delivery)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatNaira(totals.total)}</dd></div>
            </dl>
            <button className="btn-primary w-full py-3" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {initial?.id ? "Save changes" : "Create invoice & get link"}
            </button>
          </div>
        </Panel>
      </div>
    </form>
  );
}
