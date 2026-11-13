"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, CreditCard, Download, Loader2, Lock } from "lucide-react";
import InvoiceDocument, { invoiceState } from "./InvoiceDocument";
import { WhatsAppIcon } from "@/components/store/WhatsAppFab";
import { ApiError, apiFetch } from "@/lib/api";
import { withContactDefaults, whatsappHref } from "@/lib/contact";
import { formatNaira } from "@/lib/format";
import type { Invoice, StoreSettings } from "@/lib/types";

export default function InvoicePublic({ token }: { token: string }) {
  const [inv, setInv] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<StoreSettings>({});
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    apiFetch<Invoice>(`/api/invoices/${encodeURIComponent(token)}`)
      .then(setInv)
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? "This invoice link isn't valid. Please check the link or contact us." : e.message));
    apiFetch<StoreSettings>("/api/settings").then(setSettings).catch(() => {});
  }, [token]);

  const pay = async (provider: "paystack" | "flutterwave") => {
    setBusy(provider);
    try {
      const r = await apiFetch<{ checkout_url: string }>(`/api/invoices/${encodeURIComponent(token)}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, email }),
      });
      window.location.href = r.checkout_url;
    } catch (e) {
      toast.error((e as Error).message);
      setBusy("");
    }
  };

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-4">
        <div className="max-w-md text-center">
          <h1 className="heading text-4xl">Invoice not found</h1>
          <p className="mt-3 text-sm text-stone">{error}</p>
          <Link href="/" className="btn-primary mt-6">Visit our store</Link>
        </div>
      </main>
    );
  }
  if (!inv) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <Loader2 className="h-7 w-7 animate-spin text-bronze" />
      </main>
    );
  }

  const state = invoiceState(inv);
  const contact = withContactDefaults(settings);
  const online = settings.paystack_enabled === "true" || settings.flutterwave_enabled === "true";
  const needEmail = !inv.email;
  const waLink = whatsappHref(contact.whatsapp_number, `Hello! I have a question about invoice ${inv.number}.`);

  return (
    <main className="min-h-screen bg-cream px-4 py-8 sm:py-12 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl space-y-6">
        {inv.status === "unpaid" && (
          <section className="rounded-xl border border-line bg-white p-5 sm:p-6 print:hidden" aria-label="Pay this invoice">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-mist">{state === "overdue" ? "Overdue" : "Amount due"}</p>
                <p className="mt-1 font-serif text-4xl font-semibold">{formatNaira(inv.total)}</p>
              </div>
              <button onClick={() => window.print()} className="btn-outline btn-sm"><Download className="h-4 w-4" /> Download PDF</button>
            </div>
            {online ? (
              <div className="mt-5 space-y-3">
                {needEmail && (
                  <div>
                    <label className="label" htmlFor="pay-email">Your email (for the payment receipt)</label>
                    <input id="pay-email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {settings.paystack_enabled === "true" && (
                    <button onClick={() => pay("paystack")} disabled={!!busy || (needEmail && !email)} className="btn-primary py-3">
                      {busy === "paystack" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Pay with Paystack
                    </button>
                  )}
                  {settings.flutterwave_enabled === "true" && (
                    <button onClick={() => pay("flutterwave")} disabled={!!busy || (needEmail && !email)} className="btn-outline py-3">
                      {busy === "flutterwave" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Pay with Flutterwave
                    </button>
                  )}
                </div>
                <p className="flex items-center gap-1.5 text-xs text-mist"><Lock className="h-3.5 w-3.5" /> Card, bank transfer or USSD, processed securely by the payment provider.</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-stone">To pay this invoice, please contact us on WhatsApp for payment details.</p>
            )}
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-whatsapp hover:underline">
              <WhatsAppIcon className="h-4 w-4" /> Questions about this invoice? Chat with us
            </a>
          </section>
        )}
        {inv.status === "paid" && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 print:hidden">
            <p className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-5 w-5" /> Paid — thank you! Keep this page as your receipt.</p>
            <button onClick={() => window.print()} className="btn-outline btn-sm bg-white"><Download className="h-4 w-4" /> Download PDF</button>
          </section>
        )}
        {inv.status === "void" && (
          <section className="rounded-xl border border-line bg-white p-5 text-sm text-stone print:hidden">
            This invoice has been cancelled and can no longer be paid. <a href={waLink} target="_blank" rel="noopener noreferrer" className="text-bronze hover:underline">Contact us</a> if you have questions.
          </section>
        )}
        <InvoiceDocument invoice={inv} settings={settings} />
        <p className="text-center text-xs text-mist print:hidden">
          <Link href="/" className="hover:text-bronze">{settings.store_name || "Chris Moore Interior Decor"}</Link>
        </p>
      </div>
    </main>
  );
}
