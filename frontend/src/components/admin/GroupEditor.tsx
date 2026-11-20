"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Check,
  CheckSquare,
  Info,
  Loader2,
  Search,
  Shield,
  Square,
  Trash2,
  UsersRound,
} from "lucide-react";
import PermissionMatrix from "@/components/admin/PermissionMatrix";
import { Badge, Panel } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";
import type { AdminUser, StaffGroup } from "@/lib/types";

type Props = {
  initialGroup?: StaffGroup;
  staffMembers: AdminUser[];
  allGroups: StaffGroup[];
  onSaved?: (saved: StaffGroup) => void;
  onDeleted?: () => void;
};

export default function GroupEditor({
  initialGroup,
  staffMembers,
  allGroups,
  onSaved,
  onDeleted,
}: Props) {
  const router = useRouter();
  const isEditing = !!initialGroup?.id;

  const [name, setName] = useState(initialGroup?.name ?? "");
  const [description, setDescription] = useState(initialGroup?.description ?? "");
  const [permissions, setPermissions] = useState<string[]>(initialGroup?.permissions ?? []);
  const [memberIds, setMemberIds] = useState<string[]>(initialGroup?.member_ids ?? []);
  const [memberSearch, setMemberSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Filter staff by search keyword
  const filteredStaff = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return staffMembers;
    return staffMembers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [staffMembers, memberSearch]);

  const toggleMember = (id: string) => {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const idsToAdd = filteredStaff.map((u) => u.id);
    setMemberIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const deselectAllFiltered = () => {
    const idsToRemove = new Set(filteredStaff.map((u) => u.id));
    setMemberIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        permissions,
        member_ids: memberIds,
      };

      const saved = await adminFetch<StaffGroup>(
        isEditing ? `/groups/${initialGroup.id}` : "/groups",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      toast.success(isEditing ? `Group "${saved.name}" updated` : `Group "${saved.name}" created`);
      if (onSaved) {
        onSaved(saved);
      } else {
        router.push("/admin/staff?tab=groups");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialGroup) return;
    if (
      !confirm(
        `Delete the "${initialGroup.name}" group? Its ${memberIds.length} member(s) will stay approved but lose access to its permissions.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await adminFetch(`/groups/${initialGroup.id}`, { method: "DELETE" });
      toast.success(`Group "${initialGroup.name}" deleted`);
      if (onDeleted) {
        onDeleted();
      } else {
        router.push("/admin/staff?tab=groups");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-6xl">
      {/* 1. Group Details Panel */}
      <Panel>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <Shield className="h-5 w-5 text-bronze" />
            <h2 className="font-serif text-lg font-semibold text-ink">Role & Group Identity</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="group-name">
                Group Name <span className="text-rose-600">*</span>
              </label>
              <input
                id="group-name"
                required
                maxLength={60}
                className="input"
                placeholder="e.g. Sales Team, Inventory Managers, Procurement"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="mt-1 text-xs text-mist">
                A distinctive role title displayed across the staff directory.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="group-desc">
                Description (Optional)
              </label>
              <input
                id="group-desc"
                maxLength={300}
                className="input"
                placeholder="Brief summary of duties and operational scope"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="mt-1 text-xs text-mist">
                Helps administrators understand which staff to assign to this role.
              </p>
            </div>
          </div>
        </div>
      </Panel>

      {/* 2. Granular Permissions & CRUD Matrix Panel */}
      <Panel>
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-bronze" />
              <div>
                <h2 className="font-serif text-lg font-semibold text-ink">
                  Permissions & Granular Access Controls
                </h2>
                <p className="text-xs text-mist">
                  Select which services, CRUD actions, and sensitive controls members of this group inherit.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-sand/60 px-3 py-1 text-xs font-medium text-stone">
              {permissions.length} permission{permissions.length === 1 ? "" : "s"} selected
            </span>
          </div>

          <div className="rounded-lg bg-sand/20 border border-sand/50 p-3.5 text-xs text-stone flex items-start gap-2.5">
            <Info className="h-4 w-4 text-bronze shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-ink">Role Inheritance Rules:</p>
              <p className="text-stone mt-0.5 leading-relaxed">
                Staff members assigned to this group inherit all checked capabilities automatically. You can also grant individual user-specific overrides from the Team Members directory if a specific person needs additional privileges. Administrators always retain unrestricted full access.
              </p>
            </div>
          </div>

          <PermissionMatrix selected={permissions} onChange={setPermissions} />
        </div>
      </Panel>

      {/* 3. Assign Staff Members Panel */}
      <Panel>
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-bronze" />
              <div>
                <h2 className="font-serif text-lg font-semibold text-ink">Assigned Staff Members</h2>
                <p className="text-xs text-mist">
                  Select staff members to belong to this group. Each staff member belongs to one group at a time.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-sand/60 px-3 py-1 text-xs font-medium text-stone">
              {memberIds.length} of {staffMembers.length} member{memberIds.length === 1 ? "" : "s"} assigned
            </span>
          </div>

          {staffMembers.length === 0 ? (
            <p className="text-sm text-stone py-4 text-center">
              No staff accounts exist yet. New team members can request access at /admin/register.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Search & Bulk Select Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-cream/40 p-2.5 rounded-lg border border-line">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-mist" />
                  <input
                    type="search"
                    placeholder="Search staff members by name or email..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="input pl-9 py-1.5 text-xs w-full bg-white"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="flex items-center gap-1 rounded px-2.5 py-1.5 font-medium text-stone hover:bg-sand transition"
                  >
                    <CheckSquare className="h-3.5 w-3.5" /> Select All ({filteredStaff.length})
                  </button>
                  <span className="text-line">|</span>
                  <button
                    type="button"
                    onClick={deselectAllFiltered}
                    className="flex items-center gap-1 rounded px-2.5 py-1.5 font-medium text-stone hover:text-rose-700 transition"
                  >
                    <Square className="h-3.5 w-3.5" /> Deselect All
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="max-h-72 overflow-y-auto rounded-lg border border-line divide-y divide-line bg-white">
                {filteredStaff.length === 0 ? (
                  <p className="text-xs text-stone p-4 text-center">
                    No staff members match &ldquo;{memberSearch}&rdquo;.
                  </p>
                ) : (
                  filteredStaff.map((u) => {
                    const isSelected = memberIds.includes(u.id);
                    const currentOtherGroup =
                      u.group_id && u.group_id !== initialGroup?.id
                        ? allGroups.find((g) => g.id === u.group_id)?.name
                        : null;

                    return (
                      <label
                        key={u.id}
                        className={`flex items-center justify-between gap-3 p-3 text-xs cursor-pointer transition ${
                          isSelected ? "bg-sand/30" : "hover:bg-cream/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[#a8875e] cursor-pointer"
                            checked={isSelected}
                            onChange={() => toggleMember(u.id)}
                          />
                          <div>
                            <p className="font-semibold text-ink text-sm">{u.name}</p>
                            <p className="text-mist">{u.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {u.status !== "approved" && <Badge value={u.status} />}
                          {currentOtherGroup && (
                            <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                              moves from {currentOtherGroup}
                            </span>
                          )}
                          {isSelected && !currentOtherGroup && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-bronze-dark">
                              <Check className="h-3 w-3" /> Assigned
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* 4. Action Buttons Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div>
          {isEditing && (
            <button
              type="button"
              disabled={deleting || saving}
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 transition"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Group
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/staff?tab=groups"
            className="btn-outline px-4 py-2 text-sm"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || deleting}
            className="btn-primary px-5 py-2 text-sm flex items-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? "Save Changes" : "Create Group"}
          </button>
        </div>
      </div>
    </form>
  );
}
