"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Bold, ExternalLink, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, Quote, Table, Trash2, X } from "lucide-react";
import Markdown from "@/components/blog/Markdown";
import { Panel } from "./ui";
import { adminFetch } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/format";
import type { BlogCategory, BlogPost, Category } from "@/lib/types";

type FormState = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string;
  category: string;
  tags: string;
  author_name: string;
  status: "draft" | "published";
  is_featured: boolean;
  published_at: string; // datetime-local value
  product_category: string;
  seo_title: string;
  seo_description: string;
};

/** ISO -> "YYYY-MM-DDTHH:mm" in the browser's local time zone. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const toForm = (p?: BlogPost): FormState => ({
  title: p?.title ?? "",
  slug: p?.slug ?? "",
  excerpt: p?.excerpt ?? "",
  content: p?.content ?? "",
  cover_image: p?.cover_image ?? "",
  category: p?.category ?? "Guides",
  tags: p?.tags.join(", ") ?? "",
  author_name: p?.author_name ?? "",
  status: p?.status ?? "draft",
  is_featured: p?.is_featured ?? false,
  published_at: toLocalInput(p?.published_at ?? null),
  product_category: p?.product_category ?? "",
  seo_title: p?.seo_title ?? "",
  seo_description: p?.seo_description ?? "",
});

// Toolbar actions: wrap the selection or insert a block at the cursor.
const TOOLS = [
  { icon: Heading2, label: "Heading", before: "\n## ", after: "", placeholder: "Section heading" },
  { icon: Heading3, label: "Subheading", before: "\n### ", after: "", placeholder: "Subheading" },
  { icon: Bold, label: "Bold", before: "**", after: "**", placeholder: "bold text" },
  { icon: Italic, label: "Italic", before: "*", after: "*", placeholder: "italic text" },
  { icon: Link2, label: "Link", before: "[", after: "](/shop)", placeholder: "link text" },
  { icon: List, label: "Bullet list", before: "\n- ", after: "", placeholder: "List item" },
  { icon: ListOrdered, label: "Numbered list", before: "\n1. ", after: "", placeholder: "First step" },
  { icon: Quote, label: "Tip / quote", before: "\n> ", after: "", placeholder: "A helpful tip" },
  { icon: Table, label: "Table", before: "\n| Column | Column |\n|---|---|\n| ", after: " | Value |\n", placeholder: "Value" },
];

export default function PostForm({ post }: { post?: BlogPost }) {
  const router = useRouter();
  const [f, setF] = useState<FormState>(() => toForm(post));
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"cover" | "inline" | "">("");
  const [blogCats, setBlogCats] = useState<BlogCategory[]>([]);
  const [productCats, setProductCats] = useState<Category[]>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const inlineRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<BlogCategory[]>("/api/blog/categories").then(setBlogCats).catch(() => {});
    adminFetch<Category[]>("/categories").then(setProductCats).catch(() => {});
  }, []);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const bind = (k: keyof FormState) => ({
    value: f[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never),
  });

  const insert = (before: string, after = "", placeholder = "") => {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const selected = value.slice(a, b) || placeholder;
    const next = value.slice(0, a) + before + selected + after + value.slice(b);
    set("content", next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + before.length, a + before.length + selected.length);
    });
  };

  const upload = async (file: File | undefined, kind: "cover" | "inline") => {
    if (!file) return;
    setUploading(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { url } = await adminFetch<{ url: string }>("/uploads", { method: "POST", body: fd });
      if (kind === "cover") set("cover_image", url);
      else insert(`\n![`, `](${url})\n`, "Image description");
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading("");
      if (coverRef.current) coverRef.current.value = "";
      if (inlineRef.current) inlineRef.current.value = "";
    }
  };

  const save = async (status: FormState["status"] = f.status) => {
    if (!f.title.trim()) {
      toast.error("Add a title first");
      return;
    }
    setSaving(true);
    const body = {
      ...f,
      status,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      published_at: f.published_at ? new Date(f.published_at).toISOString() : null,
    };
    try {
      const saved = await adminFetch<BlogPost>(post ? `/blog/${post.id}` : "/blog", { method: post ? "PUT" : "POST", body: JSON.stringify(body) });
      const scheduled = saved.status === "published" && saved.published_at && new Date(saved.published_at) > new Date();
      toast.success(saved.status === "draft" ? "Draft saved" : scheduled ? "Post scheduled" : "Post published");
      if (!post) router.replace(`/admin/blog/${saved.id}`);
      else setF(toForm(saved));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!post || !confirm(`Delete “${post.title}”? This can't be undone.`)) return;
    try {
      await adminFetch(`/blog/${post.id}`, { method: "DELETE" });
      toast.success("Post deleted");
      router.replace("/admin/blog");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const words = f.content.trim() ? f.content.trim().split(/\s+/).length : 0;
  const future = f.published_at && new Date(f.published_at) > new Date();
  const isLive = post?.status === "published" && post.published_at && new Date(post.published_at) <= new Date();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="grid gap-6 xl:grid-cols-[2fr_1fr]"
    >
      <div className="space-y-6">
        <Panel>
          <div className="space-y-4 p-5">
            <div>
              <label className="label" htmlFor="title">Title</label>
              <input id="title" required className="input text-lg" {...bind("title")} placeholder="How to measure your windows for curtains" />
            </div>
            <div>
              <label className="label" htmlFor="excerpt">Excerpt</label>
              <textarea id="excerpt" rows={2} maxLength={300} className="input" {...bind("excerpt")} placeholder="A one or two sentence summary shown on cards and in search results." />
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
            <div className="flex gap-1">
              {(["write", "preview"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn("rounded-md px-3 py-1.5 text-sm capitalize", tab === t ? "bg-ink text-white" : "text-stone hover:bg-sand")}
                >
                  {t}
                </button>
              ))}
            </div>
            {tab === "write" && (
              <div className="flex flex-wrap gap-0.5">
                {TOOLS.map(({ icon: Icon, label, before, after, placeholder }) => (
                  <button key={label} type="button" title={label} aria-label={label} onClick={() => insert(before, after, placeholder)} className="rounded p-2 text-stone hover:bg-sand hover:text-ink">
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
                <button type="button" title="Insert image" aria-label="Insert image" onClick={() => inlineRef.current?.click()} className="rounded p-2 text-stone hover:bg-sand hover:text-ink">
                  {uploading === "inline" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                </button>
                <input ref={inlineRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(e) => upload(e.target.files?.[0], "inline")} />
              </div>
            )}
          </div>
          {tab === "write" ? (
            <textarea
              ref={textRef}
              {...bind("content")}
              rows={24}
              className="block w-full resize-y border-0 px-5 py-4 font-mono text-[13px] leading-relaxed text-ink outline-none"
              placeholder={"Write your article in Markdown.\n\n## A section heading\n\nSome text with **bold** and a [link](/shop)."}
            />
          ) : (
            <div className="prose prose-decor max-w-none px-6 py-5">
              {f.content.trim() ? <Markdown>{f.content}</Markdown> : <p className="text-mist">Nothing to preview yet.</p>}
            </div>
          )}
          <p className="border-t border-line px-5 py-2 text-xs text-mist">
            {words} words · ~{Math.max(1, Math.ceil(words / 200))} min read · Markdown supported (headings, lists, tables, links, images)
          </p>
        </Panel>

        <Panel title="Search engine listing">
          <div className="space-y-4 p-5">
            <div>
              <label className="label" htmlFor="seo_title">SEO title (optional)</label>
              <input id="seo_title" maxLength={70} className="input" {...bind("seo_title")} placeholder={f.title} />
            </div>
            <div>
              <label className="label" htmlFor="seo_desc">Meta description (optional)</label>
              <textarea id="seo_desc" rows={2} maxLength={170} className="input" {...bind("seo_description")} placeholder={f.excerpt} />
              <p className="mt-1 text-xs text-mist">{(f.seo_description || f.excerpt).length}/160 characters recommended</p>
            </div>
            <div>
              <label className="label" htmlFor="slug">URL slug</label>
              <div className="flex items-center rounded-md border border-line bg-cream/50 pl-3 text-sm text-mist focus-within:border-bronze">
                /blog/
                <input id="slug" className="w-full bg-white px-2 py-2.5 text-ink outline-none" {...bind("slug")} placeholder="auto from title" />
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Publish">
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-2">
              {(["draft", "published"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("status", s)}
                  className={cn("rounded-md border px-3 py-2 text-sm", f.status === s ? "border-bronze bg-bronze/10 font-medium" : "border-line text-stone hover:border-bronze/60")}
                >
                  {s === "draft" ? "Draft" : "Published"}
                </button>
              ))}
            </div>
            <div>
              <label className="label" htmlFor="published_at">Publish date</label>
              <input id="published_at" type="datetime-local" className="input" {...bind("published_at")} />
              <p className="mt-1 text-xs text-mist">
                {f.status === "published" && future ? "Scheduled — goes live automatically at this time." : "Leave empty to publish immediately."}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.is_featured} onChange={(e) => set("is_featured", e.target.checked)} className="h-4 w-4 accent-[#a8875e]" />
              Feature at the top of the blog
            </label>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {f.status === "draft" ? "Save draft" : future ? "Schedule" : post?.status === "published" ? "Update" : "Publish"}
              </button>
              {post && (
                <button type="button" onClick={remove} className="btn border border-red-200 px-3 text-red-700 hover:bg-red-50" aria-label="Delete post">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {isLive && (
              <Link href={`/blog/${post!.slug}`} target="_blank" className="flex items-center justify-center gap-1.5 text-sm text-bronze hover:underline">
                View live post <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </Panel>

        <Panel title="Cover image">
          <div className="p-5">
            {f.cover_image ? (
              <div className="group relative aspect-[16/10] overflow-hidden rounded-lg bg-sand">
                <Image src={f.cover_image} alt="" fill sizes="360px" className="object-cover" />
                <button type="button" onClick={() => set("cover_image", "")} className="absolute right-2 top-2 rounded bg-white/90 p-1" aria-label="Remove cover image">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverRef.current?.click()}
                className="grid aspect-[16/10] w-full place-items-center rounded-lg border-2 border-dashed border-oat text-sm text-stone hover:border-bronze hover:text-bronze"
              >
                {uploading === "cover" ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="flex flex-col items-center gap-1"><ImagePlus className="h-5 w-5" /> Upload cover</span>}
              </button>
            )}
            <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(e) => upload(e.target.files?.[0], "cover")} />
            <input className="input mt-3" type="url" {...bind("cover_image")} placeholder="…or paste an image URL" />
          </div>
        </Panel>

        <Panel title="Organisation">
          <div className="space-y-4 p-5">
            <div>
              <label className="label" htmlFor="category">Category</label>
              <input id="category" list="blog-categories" className="input" {...bind("category")} />
              <datalist id="blog-categories">
                {[...new Set(["Guides", "Inspiration", "Bedroom", "Living Room", "Care Tips", "News", ...blogCats.map((c) => c.name)])].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label" htmlFor="tags">Tags (comma separated)</label>
              <input id="tags" className="input" {...bind("tags")} placeholder="curtains, measuring" />
            </div>
            <div>
              <label className="label" htmlFor="author">Author</label>
              <input id="author" className="input" {...bind("author_name")} placeholder="Your name" />
            </div>
            <div>
              <label className="label" htmlFor="pc">“Shop the look” products</label>
              <select id="pc" className="input" {...bind("product_category")}>
                <option value="">None</option>
                {productCats.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-mist">Shows popular products from this category under the article.</p>
            </div>
          </div>
        </Panel>
      </div>
    </form>
  );
}
