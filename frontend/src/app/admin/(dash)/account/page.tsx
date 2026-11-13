"use client";

import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { Info, Loader2, Lock } from "lucide-react";
import AuthInput from "@/components/admin/AuthInput";
import { useMe } from "@/components/admin/AdminShell";
import { Badge, PageHeader, Panel } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";
import { formatDate } from "@/lib/format";

const LABELS: Record<string, string> = {
  dashboard: "Overview & sales stats",
  orders: "Orders",
  invoices: "Invoices",
  products: "Products & categories",
  inventory: "Inventory",
  reviews: "Reviews",
  blog: "Blog",
  subscribers: "Subscribers",
  settings: "Store settings",
};

export default function AccountPage() {
  const me = useMe();
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [saving, setSaving] = useState(false);

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.new_password !== pw.confirm) {
      toast.error("New passwords don't match");
      return;
    }
    setSaving(true);
    try {
      await adminFetch("/password", {
        method: "POST",
        body: JSON.stringify({ current_password: pw.current_password, new_password: pw.new_password }),
      });
      toast.success("Password updated");
      setPw({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const noAccess = me.role !== "admin" && me.permissions.length === 0;

  return (
    <>
      <PageHeader title="My account" subtitle="Your profile, access and password." />
      {noAccess && (
        <p className="mb-6 flex gap-2.5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Your account is approved, but you haven&apos;t been given access to any section yet. Ask an administrator to add you to a group.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Profile">
          <dl className="space-y-3 p-5 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-stone">Name</dt><dd className="font-medium">{me.name}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-stone">Email</dt><dd>{me.email}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-stone">Role</dt><dd><Badge value={me.role} /></dd></div>
            {me.role !== "admin" && (
              <div className="flex justify-between gap-4"><dt className="text-stone">Group</dt><dd>{me.group_name || "None yet"}</dd></div>
            )}
            <div className="flex justify-between gap-4"><dt className="text-stone">Member since</dt><dd>{formatDate(me.created_at)}</dd></div>
          </dl>
          <div className="border-t border-line p-5">
            <p className="label">You can access</p>
            {me.role === "admin" ? (
              <p className="text-sm text-stone">Everything, including <Link href="/admin/staff" className="text-bronze hover:underline">staff &amp; roles</Link>.</p>
            ) : me.permissions.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {me.permissions.map((p) => (
                  <li key={p} className="rounded-full bg-sand px-2.5 py-1 text-xs text-cocoa">{LABELS[p] ?? p}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone">Nothing yet.</p>
            )}
          </div>
        </Panel>
        <form onSubmit={changePw}>
          <Panel title="Change password">
            <div className="space-y-4 p-5">
              <div>
                <label className="label" htmlFor="cur">Current password</label>
                <AuthInput icon={Lock} id="cur" type="password" required value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} autoComplete="current-password" />
              </div>
              <div>
                <label className="label" htmlFor="new">New password</label>
                <AuthInput icon={Lock} id="new" type="password" minLength={8} maxLength={72} required value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} autoComplete="new-password" />
              </div>
              <div>
                <label className="label" htmlFor="confirm">Confirm new password</label>
                <AuthInput icon={Lock} id="confirm" type="password" minLength={8} maxLength={72} required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" />
              </div>
              <button className="btn-dark w-full" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Update password</button>
            </div>
          </Panel>
        </form>
      </div>
    </>
  );
}
