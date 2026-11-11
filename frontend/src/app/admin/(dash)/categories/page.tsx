"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Empty, Modal, PageHeader, Panel, Spinner } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";
import type { Category } from "@/lib/types";

type Form = { id?: string; name: string; slug: string; description: string; image_url: string; sort_order: string };
const blank: Form = { name: "", slug: "", description: "", image_url: "", sort_order: "0" };

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    adminFetch<Category[]>("/categories").then(setItems).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const body = JSON.stringify({ ...form, id: undefined, sort_order: Number(form.sort_order || 0) });
      await adminFetch(form.id ? `/categories/${form.id}` : "/categories", { method: form.id ? "PUT" : "POST", body });
      toast.success(form.id ? "Category updated" : "Category created");
      setForm(null);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Category) => {
    if (!confirm(`Delete “${c.name}”? Its products will become uncategorised.`)) return;
    try {
      await adminFetch(`/categories/${c.id}`, { method: "DELETE" });
      toast.success("Category deleted");
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => f && { ...f, [k]: e.target.value });

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Shown on the home page, navigation and shop filters."
        actions={<button onClick={() => setForm(blank)} className="btn-primary btn-sm"><Plus className="h-4 w-4" /> Add category</button>}
      />
      <Panel>
        {!items ? (
          <Spinner />
        ) : items.length === 0 ? (
          <Empty>No categories yet.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((c) => (
              <li key={c.id} className="flex items-center gap-4 px-5 py-4">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-sand">
                  {c.image_url && <Image src={c.image_url} alt="" fill sizes="56px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name} <span className="text-xs font-normal text-mist">/{c.slug}</span></p>
                  <p className="truncate text-sm text-stone">{c.description}</p>
                </div>
                <span className="hidden text-sm text-stone sm:block">{c.product_count} products</span>
                <button
                  onClick={() => setForm({ id: c.id, name: c.name, slug: c.slug, description: c.description, image_url: c.image_url, sort_order: String(c.sort_order) })}
                  className="rounded p-2 hover:bg-sand"
                  aria-label={`Edit ${c.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => remove(c)} className="rounded p-2 text-red-700 hover:bg-red-50" aria-label={`Delete ${c.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Edit category" : "New category"}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <div><label className="label" htmlFor="cn">Name</label><input id="cn" required className="input" value={form.name} onChange={set("name")} /></div>
            <div><label className="label" htmlFor="cs">Slug (optional)</label><input id="cs" className="input" value={form.slug} onChange={set("slug")} placeholder="auto from name" /></div>
            <div><label className="label" htmlFor="cd">Description</label><textarea id="cd" rows={2} className="input" value={form.description} onChange={set("description")} /></div>
            <div><label className="label" htmlFor="ci">Image URL</label><input id="ci" type="url" className="input" value={form.image_url} onChange={set("image_url")} /></div>
            <div><label className="label" htmlFor="co">Sort order</label><input id="co" type="number" className="input" value={form.sort_order} onChange={set("sort_order")} /></div>
            <button className="btn-primary w-full" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</button>
          </form>
        )}
      </Modal>
    </>
  );
}
