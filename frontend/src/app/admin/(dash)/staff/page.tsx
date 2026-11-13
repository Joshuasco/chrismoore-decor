"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Check, Loader2, Pencil, Plus, ShieldCheck, Trash2, UserX, UsersRound } from "lucide-react";
import { useMe } from "@/components/admin/AdminShell";
import { Badge, Empty, Modal, PageHeader, Panel, Spinner } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";
import { cn, formatDate } from "@/lib/format";
import type { AdminUser, Permission, StaffGroup } from "@/lib/types";

type Groups = { items: StaffGroup[]; permissions: Permission[] };
type GroupForm = { id?: string; name: string; description: string; permissions: string[]; member_ids: string[] };

const STATUS_TABS = [
  { id: "pending", label: "Awaiting approval" },
  { id: "approved", label: "Approved" },
  { id: "disapproved", label: "Disapproved" },
  { id: "", label: "All" },
] as const;

export default function StaffPage() {
  const me = useMe();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [groups, setGroups] = useState<Groups | null>(null);
  const [tab, setTab] = useState<"team" | "groups">("team");
  const [status, setStatus] = useState<string>("pending");
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState<GroupForm | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);

  const load = useCallback(() => {
    Promise.all([adminFetch<{ items: AdminUser[] }>("/staff"), adminFetch<Groups>("/groups")])
      .then(([u, g]) => {
        setUsers(u.items);
        setGroups(g);
        // Open on the pending tab only when someone is waiting.
        setStatus((s) => (s === "pending" && !u.items.some((x) => x.status === "pending") ? "approved" : s));
      })
      .catch((e) => toast.error(e.message));
  }, []);

  useEffect(load, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { "": users?.length ?? 0, pending: 0, approved: 0, disapproved: 0 };
    users?.forEach((u) => (c[u.status] += 1));
    return c;
  }, [users]);

  const permLabel = useMemo(() => Object.fromEntries((groups?.permissions ?? []).map((p) => [p.key, p.label])), [groups]);

  if (!users || !groups) return <Spinner />;

  const replaceUser = (u: AdminUser) => setUsers((list) => list?.map((x) => (x.id === u.id ? u : x)) ?? null);

  const update = async (u: AdminUser, patch: { status?: string; role?: string; group_id?: string }, done: string) => {
    if (patch.status === "disapproved" && !confirm(`Disapprove ${u.name}? They'll be signed out right away and can't use the dashboard until approved again.`)) return;
    if (patch.role === "admin" && !confirm(`Make ${u.name} an administrator? Admins can access everything, including staff and groups.`)) return;
    setBusy(u.id);
    try {
      const updated = await adminFetch<AdminUser>(`/staff/${u.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      replaceUser(updated);
      if (patch.group_id !== undefined) load(); // refresh group member counts
      toast.success(done);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const remove = async (u: AdminUser) => {
    if (!confirm(`Delete ${u.name}'s account (${u.email})? This can't be undone.`)) return;
    setBusy(u.id);
    try {
      await adminFetch(`/staff/${u.id}`, { method: "DELETE" });
      setUsers((list) => list?.filter((x) => x.id !== u.id) ?? null);
      toast.success("Account deleted");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const saveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSavingGroup(true);
    try {
      const { id, ...body } = editing;
      await adminFetch<StaffGroup>(id ? `/groups/${id}` : "/groups", { method: id ? "PUT" : "POST", body: JSON.stringify(body) });
      toast.success(id ? "Group updated" : "Group created");
      setEditing(null);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingGroup(false);
    }
  };

  const deleteGroup = async (g: StaffGroup) => {
    if (!confirm(`Delete the "${g.name}" group? Its ${g.member_ids.length} member(s) will stay approved but lose access to its sections.`)) return;
    try {
      await adminFetch(`/groups/${g.id}`, { method: "DELETE" });
      toast.success("Group deleted");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const staffMembers = users.filter((u) => u.role === "staff");
  const shown = users.filter((u) => !status || u.status === status);
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown";

  return (
    <>
      <PageHeader
        title="Staff & roles"
        subtitle="Approve staff sign-ups and choose which sections each group can use."
        actions={
          tab === "groups" && (
            <button className="btn-primary btn-sm" onClick={() => setEditing({ name: "", description: "", permissions: [], member_ids: [] })}>
              <Plus className="h-4 w-4" /> New group
            </button>
          )
        }
      />

      <div className="mb-5 flex gap-6 border-b border-line text-sm">
        {(["team", "groups"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn("-mb-px border-b-2 pb-2.5", tab === t ? "border-bronze font-medium text-ink" : "border-transparent text-stone hover:text-ink")}
          >
            {t === "team" ? "Team members" : `Groups (${groups.items.length})`}
            {t === "team" && counts.pending > 0 && (
              <span className="ml-2 rounded-full bg-bronze px-1.5 py-0.5 text-[10px] font-semibold text-white">{counts.pending}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "team" ? (
        <>
          <div className="no-scrollbar mb-4 flex gap-1 overflow-x-auto">
            {STATUS_TABS.map((s) => (
              <button
                key={s.id || "all"}
                onClick={() => setStatus(s.id)}
                className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs", status === s.id ? "bg-ink text-white" : "bg-white text-stone ring-1 ring-line hover:text-ink")}
              >
                {s.label} · {counts[s.id]}
              </button>
            ))}
          </div>
          <Panel>
            {shown.length === 0 ? (
              <Empty>
                {status === "pending" ? "No one is waiting for approval. New staff can request access at /admin/register." : "No accounts here."}
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-cream/60 text-left text-xs text-stone">
                    <tr>
                      <th className="px-5 py-3 font-medium">Person</th>
                      <th className="px-3 py-3 font-medium">Role</th>
                      <th className="px-3 py-3 font-medium">Group</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Activity</th>
                      <th className="px-5 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {shown.map((u) => {
                      const self = u.id === me.id;
                      return (
                        <tr key={u.id} className="align-middle">
                          <td className="px-5 py-3">
                            <p className="font-medium">{u.name}{self && <span className="ml-2 text-xs font-normal text-mist">(you)</span>}</p>
                            <p className="text-xs text-mist">{u.email}</p>
                          </td>
                          <td className="px-3 py-3"><Badge value={u.role} /></td>
                          <td className="px-3 py-3">
                            {u.role === "admin" ? (
                              <span className="text-xs text-mist">Full access</span>
                            ) : (
                              <select
                                aria-label={`Group for ${u.name}`}
                                className="input w-44 py-1.5 text-xs"
                                value={u.group_id ?? ""}
                                disabled={busy === u.id}
                                onChange={(e) => update(u, { group_id: e.target.value }, e.target.value ? "Group assigned" : "Removed from group")}
                              >
                                <option value="">No group (no access)</option>
                                {groups.items.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-3"><Badge value={u.status} /></td>
                          <td className="px-3 py-3 text-xs text-stone">
                            <p>Joined {formatDate(u.created_at)}</p>
                            <p className="text-mist">{u.last_login_at ? `Last sign-in ${formatDate(u.last_login_at, true)}` : "Never signed in"}</p>
                          </td>
                          <td className="px-5 py-3">
                            {self ? (
                              <p className="text-right text-xs text-mist">—</p>
                            ) : (
                              <div className="flex justify-end gap-1.5">
                                {busy === u.id && <Loader2 className="h-4 w-4 animate-spin self-center text-bronze" />}
                                {u.status !== "approved" && (
                                  <button className="btn-primary btn-sm" disabled={busy === u.id} onClick={() => update(u, { status: "approved" }, `${u.name} approved`)}>
                                    <Check className="h-4 w-4" /> Approve
                                  </button>
                                )}
                                {u.status !== "disapproved" && (
                                  <button className="btn-outline btn-sm" disabled={busy === u.id} onClick={() => update(u, { status: "disapproved" }, `${u.name} disapproved`)}>
                                    <UserX className="h-4 w-4" /> Disapprove
                                  </button>
                                )}
                                {u.status === "approved" && (
                                  <button
                                    className="btn-outline btn-sm"
                                    disabled={busy === u.id}
                                    title={u.role === "admin" ? "Make staff" : "Make admin"}
                                    onClick={() => update(u, { role: u.role === "admin" ? "staff" : "admin" }, u.role === "admin" ? "Changed to staff" : "Now an admin")}
                                  >
                                    <ShieldCheck className="h-4 w-4" /> {u.role === "admin" ? "Make staff" : "Make admin"}
                                  </button>
                                )}
                                <button className="rounded-md p-2 text-stone hover:bg-red-50 hover:text-red-700" disabled={busy === u.id} onClick={() => remove(u)} aria-label={`Delete ${u.name}`}>
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <p className="mt-3 text-xs text-mist">
            Staff only see the sections their group allows. Disapproving someone signs them out immediately; approve them again to restore access.
          </p>
        </>
      ) : groups.items.length === 0 ? (
        <Panel>
          <div className="px-5 py-12 text-center">
            <UsersRound className="mx-auto h-8 w-8 text-bronze" />
            <p className="mt-3 font-medium">No groups yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-stone">Create a group such as &ldquo;Sales&rdquo; or &ldquo;Content team&rdquo;, choose the sections it can use, and add staff to it.</p>
            <button className="btn-primary btn-sm mt-5" onClick={() => setEditing({ name: "", description: "", permissions: [], member_ids: [] })}>
              <Plus className="h-4 w-4" /> New group
            </button>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.items.map((g) => (
            <Panel key={g.id} className="flex flex-col">
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-xl font-semibold">{g.name}</h2>
                    {g.description && <p className="mt-0.5 text-sm text-stone">{g.description}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      className="rounded-md p-2 text-stone hover:bg-sand hover:text-ink"
                      aria-label={`Edit ${g.name}`}
                      onClick={() => setEditing({ id: g.id, name: g.name, description: g.description, permissions: g.permissions, member_ids: g.member_ids })}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="rounded-md p-2 text-stone hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${g.name}`} onClick={() => deleteGroup(g)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="label mt-4">Can access</p>
                {g.permissions.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {g.permissions.map((p) => <li key={p} className="rounded-full bg-sand px-2.5 py-1 text-xs text-cocoa">{permLabel[p] ?? p}</li>)}
                  </ul>
                ) : (
                  <p className="text-sm text-mist">No sections yet</p>
                )}
              </div>
              <div className="border-t border-line px-5 py-3 text-sm text-stone">
                {g.member_ids.length ? `${g.member_ids.length} member${g.member_ids.length === 1 ? "" : "s"}: ${g.member_ids.map(userName).join(", ")}` : "No members"}
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit group" : "New group"} wide>
        {editing && (
          <form onSubmit={saveGroup} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="g-name">Group name</label>
                <input id="g-name" required maxLength={60} className="input" placeholder="e.g. Sales team" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="g-desc">Description (optional)</label>
                <input id="g-desc" maxLength={300} className="input" placeholder="What this group does" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
            </div>
            <fieldset>
              <legend className="label">Sections this group can use</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {groups.permissions.map((p) => (
                  <label key={p.key} className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line px-3 py-2 text-sm hover:bg-cream/60">
                    <input
                      type="checkbox"
                      className="accent-bronze"
                      checked={editing.permissions.includes(p.key)}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          permissions: e.target.checked ? [...editing.permissions, p.key] : editing.permissions.filter((x) => x !== p.key),
                        })
                      }
                    />
                    {p.label}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-mist">Managing staff and groups is always admin-only.</p>
            </fieldset>
            <fieldset>
              <legend className="label">Members</legend>
              {staffMembers.length === 0 ? (
                <p className="text-sm text-stone">No staff accounts yet.</p>
              ) : (
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-line p-2">
                  {staffMembers.map((u) => {
                    const other = u.group_id && u.group_id !== editing.id ? groups.items.find((g) => g.id === u.group_id)?.name : "";
                    return (
                      <label key={u.id} className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-cream/60">
                        <input
                          type="checkbox"
                          className="accent-bronze"
                          checked={editing.member_ids.includes(u.id)}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              member_ids: e.target.checked ? [...editing.member_ids, u.id] : editing.member_ids.filter((x) => x !== u.id),
                            })
                          }
                        />
                        <span className="flex-1">
                          {u.name} <span className="text-xs text-mist">{u.email}</span>
                        </span>
                        {u.status !== "approved" && <Badge value={u.status} />}
                        {other && <span className="text-xs text-mist">moves from {other}</span>}
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="mt-1.5 text-xs text-mist">Each staff member belongs to one group. Admins have full access and aren&apos;t listed.</p>
            </fieldset>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" disabled={savingGroup}>{savingGroup && <Loader2 className="h-4 w-4 animate-spin" />} {editing.id ? "Save group" : "Create group"}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
