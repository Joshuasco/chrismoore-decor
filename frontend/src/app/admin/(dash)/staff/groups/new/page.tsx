"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import GroupEditor from "@/components/admin/GroupEditor";
import { PageHeader, Spinner } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";
import type { AdminUser, StaffGroup } from "@/lib/types";

export default function NewGroupPage() {
  const [staff, setStaff] = useState<AdminUser[] | null>(null);
  const [allGroups, setAllGroups] = useState<StaffGroup[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminFetch<{ items: AdminUser[] }>("/staff"),
      adminFetch<{ items: StaffGroup[] }>("/groups"),
    ])
      .then(([u, g]) => {
        setStaff(u.items.filter((x) => x.role === "staff"));
        setAllGroups(g.items);
      })
      .catch((err) => {
        toast.error((err as Error).message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading || !staff || !allGroups) {
    return <Spinner />;
  }

  return (
    <>
      <Link
        href="/admin/staff?tab=groups"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-stone hover:text-ink transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Staff & Groups
      </Link>

      <PageHeader
        title="New Role / Group"
        subtitle="Configure role details, define granular CRUD & sensitive field permissions, and assign staff members."
      />

      <div className="mt-4 pb-12">
        <GroupEditor staffMembers={staff} allGroups={allGroups} />
      </div>
    </>
  );
}
