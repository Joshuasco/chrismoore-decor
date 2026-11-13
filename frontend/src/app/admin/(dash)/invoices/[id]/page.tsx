"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Ban, CheckCircle2, Copy, ExternalLink, Loader2, Mail, Pencil, RotateCcw, Share2, Trash2 } from "lucide-react";
import InvoiceForm from "@/components/admin/InvoiceForm";
import { Badge, PageHeader, Panel, Spinner } from "@/components/admin/ui";
import InvoiceDocument, { invoiceState } from "@/components/invoice/InvoiceDocument";
import { WhatsAppIcon } from "@/components/store/WhatsAppFab";
import { adminFetch } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import { formatDate, STATUS_LABEL } from "@/lib/format";
import type { InvoiceDetail, StoreSettings } from "@/lib/types";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<InvoiceDetail | null>(null);
  const [settings, setSettings] = useState<StoreSettings>({});
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    adminFetch<InvoiceDetail>(`/invoices/${id}`).then(setD).catch((e) => toast.error(e.message));
    apiFetch<StoreSettings>("/api/settings").then(setSettings).catch(() => {});
  }, [id]);

  if (!d) return <Spinner />;
  const inv = d.invoice;
  const state = invoiceState(inv);

  const setStatus = async (status: "paid" | "unpaid" | "void") => {
    const prompts: Record<string, string> = {
      paid: "Mark this invoice as paid? Use this when the customer paid by bank transfer or cash.",
      void: "Void this invoice? The payment link will stop accepting payments and any reserved products go back into stock. You can reopen it later.",
      unpaid: "Reopen this invoice as unpaid?",
    };
    if (!confirm(prompts[status])) return;
    setBusy(status);
    try {
      setD(await adminFetch<InvoiceDetail>(`/invoices/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }));
      toast.success(`Invoice ${STATUS_LABEL[status].toLowerCase()}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    if (!confirm(`Delete ${inv.number}? The payment link will stop working and any reserved products go back into stock. This can't be undone.`)) return;
    setBusy("delete");
    try {
      await adminFetch(`/invoices/${id}`, { method: "DELETE" });
      toast.success("Invoice deleted");
      router.replace("/admin/invoices");
    } catch (e) {
      toast.error((e as Error).message);
      setBusy("");
    }
  };

  const copy = () => navigator.clipboard.writeText(d.invoice_url).then(() => toast.success("Payment link copied"));
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const share = () =>
    navigator.share({ title: `Invoice ${inv.number}`, text: `Invoice ${inv.number} from Chris Moore Interior Decor`, url: d.invoice_url }).catch(() => {});

  if (editing) {
    return (
      <>
        <button onClick={() => setEditing(false)} className="mb-4 inline-flex items-center gap-1.5 text-sm text-stone hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to {inv.number}
        </button>
        <PageHeader title={`Edit ${inv.number}`} subtitle="The payment link stays the same, so you don't need to send a new one." />
        <InvoiceForm
          initial={inv}
          onSaved={(nd) => {
            setD(nd);
            setEditing(false);
            toast.success("Invoice updated");
          }}
        />
      </>
    );
  }

  return (
    <>
      <Link href="/admin/invoices" className="mb-4 inline-flex items-center gap-1.5 text-sm text-stone hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Invoices
      </Link>
      <PageHeader
        title={`Invoice ${inv.number}`}
        subtitle={`Created ${formatDate(inv.created_at, true)}${inv.created_by_name ? ` by ${inv.created_by_name}` : ""}`}
        actions={
          <>
            {inv.status === "unpaid" && (
              <button className="btn-outline btn-sm" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</button>
            )}
            <a href={d.invoice_url} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm"><ExternalLink className="h-4 w-4" /> Customer view</a>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <InvoiceDocument invoice={inv} settings={settings} />

        <div className="space-y-6">
          {inv.status === "unpaid" && (
            <Panel title="Share payment link">
              <div className="space-y-3 p-5">
                <div className="flex gap-2">
                  <input readOnly aria-label="Payment link" value={d.invoice_url} className="input min-w-0 flex-1 bg-cream/60 text-xs" onFocus={(e) => e.target.select()} />
                  <button className="btn-outline btn-sm shrink-0" onClick={copy}><Copy className="h-4 w-4" /> Copy</button>
                </div>
                {d.whatsapp_url ? (
                  <a href={d.whatsapp_url} target="_blank" rel="noopener noreferrer" className="btn-whatsapp w-full">
                    <WhatsAppIcon className="h-4 w-4" /> Send on WhatsApp
                  </a>
                ) : (
                  <p className="text-xs text-mist">Add the customer&apos;s phone number to send it on WhatsApp.</p>
                )}
                {d.email_url ? (
                  <a href={d.email_url} className="btn-outline w-full"><Mail className="h-4 w-4" /> Send by email</a>
                ) : (
                  <p className="text-xs text-mist">Add the customer&apos;s email to send it by email.</p>
                )}
                {canShare && (
                  <button className="btn-outline w-full" onClick={share}><Share2 className="h-4 w-4" /> More sharing options</button>
                )}
                <p className="text-xs text-mist">The customer can view, download and pay the invoice with Paystack or Flutterwave from this link.</p>
              </div>
            </Panel>
          )}

          <Panel title="Status">
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center gap-2">
                <Badge value={state} />
                {inv.status === "paid" && inv.payment_provider && <span className="text-xs text-stone">via {STATUS_LABEL[inv.payment_provider] ?? inv.payment_provider}</span>}
              </div>
              {inv.paid_at && <p className="text-xs text-stone">Paid {formatDate(inv.paid_at, true)}</p>}
              {inv.status === "unpaid" && (
                <>
                  <button className="btn-primary w-full" disabled={!!busy} onClick={() => setStatus("paid")}>
                    {busy === "paid" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Mark as paid
                  </button>
                  <p className="text-xs text-mist">For bank transfers or cash. Online payments are marked paid automatically.</p>
                  <button className="btn-outline w-full" disabled={!!busy} onClick={() => setStatus("void")}>
                    {busy === "void" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Void invoice
                  </button>
                </>
              )}
              {(inv.status === "void" || (inv.status === "paid" && inv.payment_provider === "manual")) && (
                <button className="btn-outline w-full" disabled={!!busy} onClick={() => setStatus("unpaid")}>
                  {busy === "unpaid" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reopen as unpaid
                </button>
              )}
              {inv.status === "paid" && inv.payment_provider !== "manual" && (
                <p className="text-xs text-mist">Paid online. Payments confirmed by the provider can&apos;t be changed here.</p>
              )}
              {inv.status !== "paid" && (
                <button className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm text-red-700 hover:bg-red-50" disabled={!!busy} onClick={remove}>
                  <Trash2 className="h-4 w-4" /> Delete invoice
                </button>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
