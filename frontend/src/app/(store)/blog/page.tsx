import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Search, X } from "lucide-react";
import PostCard from "@/components/blog/PostCard";
import { getBlogCategories, getPosts } from "@/lib/api";
import { cn, formatDate } from "@/lib/format";

type SP = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Journal — Interior Ideas & Guides",
  description: "Styling ideas, measuring guides and care tips for curtains, bedding, vertical blinds and rugs from Chris Moore Interior Decor.",
  alternates: { types: { "application/rss+xml": "/blog/rss.xml" } },
};

export default async function BlogPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const category = get("category");
  const tag = get("tag");
  const q = get("q");
  const page = Math.max(1, Number(get("page")) || 1);
  const filtered = Boolean(category || tag || q);

  const [categories, posts, featuredRes] = await Promise.all([
    getBlogCategories(),
    getPosts({ category, tag, q, page, limit: 9 }),
    !filtered && page === 1 ? getPosts({ featured: true, limit: 1 }) : Promise.resolve(null),
  ]);
  const featured = featuredRes?.items[0];
  const items = featured ? posts.items.filter((p) => p.id !== featured.id) : posts.items;
  const pages = Math.max(1, Math.ceil(posts.total / posts.limit));
  const total = categories.reduce((n, c) => n + c.count, 0);

  const href = (patch: Record<string, string>) => {
    const next = new URLSearchParams();
    Object.entries({ category, tag, q, ...patch }).forEach(([k, v]) => v && next.set(k, v));
    if (!("page" in patch)) next.delete("page");
    const s = next.toString();
    return s ? `/blog?${s}` : "/blog";
  };

  return (
    <>
      <section className="border-b border-line bg-cream">
        <div className="container-x py-14 sm:py-20">
          <p className="eyebrow">Ideas & guides</p>
          <h1 className="heading mt-3 text-5xl sm:text-6xl">
            The Journal
            <span className="block text-3xl italic text-bronze sm:text-4xl">Inspiration for a home you&apos;ll love</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-stone">
            Measuring guides, styling ideas and care tips for curtains, bedding, vertical blinds and rugs — from the Chris Moore
            Interior Decor team.
          </p>
          <form action="/blog" className="mt-8 flex max-w-md items-center gap-2 rounded-md border border-line bg-white pl-3 focus-within:border-bronze">
            <Search className="h-4 w-4 shrink-0 text-mist" />
            {category && <input type="hidden" name="category" value={category} />}
            <input name="q" defaultValue={q} placeholder="Search articles" aria-label="Search articles" className="w-full bg-transparent py-3 text-sm outline-none" />
            <button className="btn-primary btn-sm mr-1">Search</button>
          </form>
        </div>
      </section>

      <div className="container-x">
        {categories.length > 0 && (
          <nav className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Blog categories">
            <Link href={href({ category: "", tag: "" })} className={cn("whitespace-nowrap rounded-full px-4 py-2 text-sm transition", !category && !tag ? "bg-ink text-white" : "bg-white text-stone ring-1 ring-line hover:text-ink")}>
              All <span className="opacity-60">{total}</span>
            </Link>
            {categories.map((c) => (
              <Link
                key={c.name}
                href={href({ category: c.name, tag: "" })}
                className={cn("whitespace-nowrap rounded-full px-4 py-2 text-sm transition", category.toLowerCase() === c.name.toLowerCase() ? "bg-ink text-white" : "bg-white text-stone ring-1 ring-line hover:text-ink")}
              >
                {c.name} <span className="opacity-60">{c.count}</span>
              </Link>
            ))}
          </nav>
        )}

        {filtered && (
          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-stone">
            <span>{posts.total} {posts.total === 1 ? "article" : "articles"}</span>
            {q && <Link href={href({ q: "" })} className="flex items-center gap-1 rounded-full bg-sand px-3 py-1 text-xs text-ink">“{q}” <X className="h-3 w-3" /></Link>}
            {tag && <Link href={href({ tag: "" })} className="flex items-center gap-1 rounded-full bg-sand px-3 py-1 text-xs text-ink">#{tag} <X className="h-3 w-3" /></Link>}
          </div>
        )}

        {featured && (
          <Link href={`/blog/${featured.slug}`} className="group mt-10 grid overflow-hidden rounded-2xl bg-white shadow-card transition hover:shadow-lift lg:grid-cols-[1.3fr_1fr]">
            <div className="relative aspect-[16/10] overflow-hidden bg-sand lg:aspect-auto lg:min-h-[420px]">
              {featured.cover_image && (
                <Image src={featured.cover_image} alt="" fill priority sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover transition duration-700 group-hover:scale-105" />
              )}
            </div>
            <div className="flex flex-col justify-center p-7 sm:p-10">
              <p className="eyebrow">Featured · {featured.category}</p>
              <h2 className="heading mt-3 text-3xl group-hover:text-bronze-dark sm:text-4xl">{featured.title}</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-stone">{featured.excerpt}</p>
              <p className="mt-5 flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-mist">
                {featured.published_at && formatDate(featured.published_at)} <span aria-hidden>·</span>
                <Clock className="h-3 w-3" /> {featured.reading_minutes} min read
              </p>
              <span className="btn-primary mt-7 w-fit">
                Read article <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        )}

        {items.length === 0 && !featured ? (
          <div className="mt-10 rounded-xl border border-dashed border-line p-16 text-center">
            <p className="font-serif text-2xl">No articles found</p>
            <p className="mt-2 text-sm text-stone">{filtered ? "Try a different search or category." : "New articles are on their way."}</p>
            {filtered && <Link href="/blog" className="btn-primary mt-6">View all articles</Link>}
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p, i) => (
              <PostCard key={p.id} post={p} priority={!featured && i < 3} />
            ))}
          </div>
        )}

        {pages > 1 && (
          <nav className="mt-12 flex justify-center gap-2" aria-label="Pagination">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={href({ page: String(n) })}
                aria-current={n === page ? "page" : undefined}
                className={cn("grid h-10 w-10 place-items-center rounded-md border text-sm", n === page ? "border-bronze bg-bronze text-white" : "border-line bg-white hover:border-bronze")}
              >
                {n}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </>
  );
}
