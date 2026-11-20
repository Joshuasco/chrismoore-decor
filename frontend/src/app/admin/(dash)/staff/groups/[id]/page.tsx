"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import GroupEditor from "@/components/admin/GroupEditor";
import { PageHeader, Spinner } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";
import type { AdminUser, StaffGroup } from "@/lib/types";

export default function EditGroupPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [group, setGroup] = useState<StaffGroup | null>(null);
  const [allGroups, setAllGroups] = useState<StaffGroup[] | null>(null);
  const [staff, setStaff] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      adminFetch<{ items: StaffGroup[] }>("/groups"),
      adminFetch<{ items: AdminUser[] }>("/staff"),
    ])
      .then(([g, u]) => {
        setAllGroups(g.items);
        const target = g.items.find((item) => item.id === id);
        if (!target) {
          setError("Group not found");
        } else {
          setGroup(target);
        }
        setStaff(u.items.filter((x) => x.role === "staff"));
      })
      .catch((err) => {
        setError((err as Error).message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) return <Spinner />;

  if (error || !group || !allGroups || !staff) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-medium text-rose-700">{error || "Group not found"}</p>
        <Link
          href="/admin/staff?tab=groups"
          className="btn-outline btn-sm mt-4 inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> Return to Groups
        </Link>
      </div>
    );
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
        title={`Edit Group — ${group.name}`}
        subtitle={`Configure permissions and manage ${group.member_ids.length} member${group.member_ids.length === 1 ? "" : "s"}.`}
      />

      <div className="mt-4 pb-12">
        <GroupEditor
          initialGroup={group}
          staffMembers={staff}
          allGroups={allGroups}
          onSaved={() => router.push("/admin/staff?tab=groups")}
          onDeleted={() => router.push("/admin/staff?tab=groups")}
        />
      </div>
    </>
  );
}
