"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { PageHeader, Panel, Spinner } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";

type Resp = { settings: Record<string, string>; integrations: Record<string, boolean> };

const FIELDS: { key: string; label: string; hint?: string; naira?: boolean }[] = [
  { key: "store_name", label: "Store name" },
  { key: "whatsapp_number", label: "WhatsApp order number", hint: "International format without +, e.g. 2348012345678" },
  { key: "contact_phone", label: "Contact phone" },
  { key: "contact_email", label: "Contact email" },
  { key: "address", label: "Showroom address" },
  { key: "opening_hours", label: "Opening hours", hint: "e.g. Always open, or Mon–Sat 9am–6pm" },
  { key: "announcement", label: "Top-bar announcement" },
  { key: "shipping_fee", label: "Delivery fee (₦)", naira: true },
  { key: "free_shipping_threshold", label: "Free delivery over (₦)", hint: "0 disables free delivery", naira: true },
  { key: "instagram", label: "Instagram URL" },
  { key: "facebook", label: "Facebook URL" },
];

const INTEGRATIONS: Record<string, string> = {
  paystack: "Paystack (PAYSTACK_SECRET_KEY)",
  flutterwave: "Flutterwave (FLUTTERWAVE_SECRET_KEY)",
  whatsapp_api: "WhatsApp Cloud API order alerts",
  image_uploads: "Supabase Storage image uploads",
  redis: "Redis cache",
};

export default function SettingsPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [pwSaving, setPwSaving] = useState(false);

  const hydrate = (r: Resp) => {
    setData(r);
    const f: Record<string, string> = {};
    FIELDS.forEach(({ key, naira }) => {
      const v = r.settings[key] ?? "";
      f[key] = naira && v ? String(Number(v) / 100) : v;
    });
    setForm(f);
  };

  useEffect(() => {
    adminFetch<Resp>("/settings").then(hydrate).catch(() => {});
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body: Record<string, string> = {};
    FIELDS.forEach(({ key, naira }) => {
      body[key] = naira ? String(Math.round(Number(form[key] || 0) * 100)) : form[key] ?? "";
    });
    try {
      hydrate(await adminFetch<Resp>("/settings", { method: "PUT", body: JSON.stringify(body) }));
      toast.success("Settings saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSaving(true);
    try {
      await adminFetch("/password", { method: "POST", body: JSON.stringify(pw) });
      toast.success("Password updated");
      setPw({ current_password: "", new_password: "" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPwSaving(false);
    }
  };

  if (!data) return <Spinner />;

  return (
    <>
      <PageHeader title="Settings" subtitle="Store details, delivery pricing and integrations." />
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <form onSubmit={save}>
          <Panel title="Store">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key} className={f.key === "announcement" || f.key === "address" ? "sm:col-span-2" : ""}>
                  <label className="label" htmlFor={f.key}>{f.label}</label>
                  <input
                    id={f.key}
                    className="input"
                    type={f.naira ? "number" : "text"}
                    min={f.naira ? 0 : undefined}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                  {f.hint && <p className="mt-1 text-xs text-mist">{f.hint}</p>}
                </div>
              ))}
            </div>
            <div className="border-t border-line p-5">
              <button className="btn-primary" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save settings</button>
            </div>
          </Panel>
        </form>

        <div className="space-y-6">
          <Panel title="Integrations">
            <ul className="divide-y divide-line">
              {Object.entries(INTEGRATIONS).map(([k, label]) => (
                <li key={k} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span>{label}</span>
                  {data.integrations[k] ? (
                    <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> On</span>
                  ) : (
                    <span className="flex items-center gap-1 text-mist"><XCircle className="h-4 w-4" /> Off</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-5 py-3 text-xs text-mist">API keys are set as environment variables on the Go server, never in the browser.</p>
          </Panel>
          <form onSubmit={changePw}>
            <Panel title="Change password">
              <div className="space-y-4 p-5">
                <div>
                  <label className="label" htmlFor="cur">Current password</label>
                  <input id="cur" type="password" required className="input" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} autoComplete="current-password" />
                </div>
                <div>
                  <label className="label" htmlFor="new">New password</label>
                  <input id="new" type="password" minLength={8} required className="input" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} autoComplete="new-password" />
                </div>
                <button className="btn-dark w-full" disabled={pwSaving}>{pwSaving && <Loader2 className="h-4 w-4 animate-spin" />} Update password</button>
              </div>
            </Panel>
          </form>
        </div>
      </div>
    </>
  );
}
