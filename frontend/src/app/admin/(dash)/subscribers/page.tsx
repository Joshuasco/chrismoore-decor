"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Empty, PageHeader, Panel, Spinner } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";

type Sub = { email: string; created_at: string };

export default function SubscribersPage() {
  const [subs, setSubs] = useState<Sub[] | null>(null);
  useEffect(() => {
    adminFetch<Sub[]>("/subscribers").then(setSubs).catch(() => {});
  }, []);

  const exportCsv = () => {
    if (!subs) return;
    const csv = "email,subscribed_at\n" + subs.map((s) => `${s.email},${s.created_at}`).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "subscribers.csv" });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Subscribers"
        subtitle="People who joined the newsletter from the storefront."
        actions={<button onClick={exportCsv} disabled={!subs?.length} className="btn-outline btn-sm"><Download className="h-4 w-4" /> Export CSV</button>}
      />
      <Panel>
        {!subs ? <Spinner /> : subs.length === 0 ? <Empty>No subscribers yet.</Empty> : (
          <ul className="divide-y divide-line">
            {subs.map((s) => (
              <li key={s.email} className="flex justify-between px-5 py-3 text-sm">
                <a href={`mailto:${s.email}`} className="hover:text-bronze">{s.email}</a>
                <span className="text-stone">{s.created_at}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
