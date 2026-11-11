import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import Markdown from "@/components/blog/Markdown";
import PostCard from "@/components/blog/PostCard";
import ShareButtons from "@/components/blog/ShareButtons";
import ProductCard from "@/components/store/ProductCard";
import { WhatsAppIcon } from "@/components/store/WhatsAppFab";
import { getPost, getSettings, SITE_URL } from "@/lib/api";
import { whatsappHref, withContactDefaults } from "@/lib/contact";
import { formatDate } from "@/lib/format";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPost(slug).catch(() => null);
  if (!data) return { title: "Article not found" };
  const p = data.post;
  const description = p.seo_description || p.excerpt;
  return {
    title: p.seo_title || p.title,
    description,
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: {
      type: "article",
      title: p.seo_title || p.title,
      description,
      publishedTime: p.published_at ?? undefined,
      modifiedTime: p.updated_at,
      authors: [p.author_name],
      tags: p.tags,
      images: p.cover_image ? [p.cover_image] : undefined,
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [data, settings] = await Promise.all([getPost(slug), getSettings()]);
  if (!data) notFound();
  const { post: p, related, products } = data;
  const contact = withContactDefaults(settings);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: p.seo_description || p.excerpt,
    image: p.cover_image || undefined,
    datePublished: p.published_at,
    dateModified: p.updated_at,
    author: { "@type": "Person", name: p.author_name },
    publisher: { "@type": "Organization", name: "Chris Moore Interior Decor" },
    mainEntityOfPage: `${SITE_URL}/blog/${p.slug}`,
    keywords: p.tags.join(", "),
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <header className="container-x max-w-3xl pt-10 text-center sm:pt-14">
        <nav className="text-xs text-mist" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-bronze">Home</Link> / <Link href="/blog" className="hover:text-bronze">Journal</Link> /{" "}
          <Link href={`/blog?category=${encodeURIComponent(p.category)}`} className="hover:text-bronze">{p.category}</Link>
        </nav>
        <Link href={`/blog?category=${encodeURIComponent(p.category)}`} className="eyebrow mt-6 inline-block hover:text-bronze-dark">
          {p.category}
        </Link>
        <h1 className="heading mt-3 text-4xl sm:text-5xl lg:text-[3.4rem]">{p.title}</h1>
        {p.excerpt && <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-stone">{p.excerpt}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-stone">
          <span className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-bronze text-xs font-semibold uppercase text-white">{p.author_name[0]}</span>
            {p.author_name}
          </span>
          <span aria-hidden className="text-oat">|</span>
          {p.published_at && <time dateTime={p.published_at}>{formatDate(p.published_at)}</time>}
          <span aria-hidden className="text-oat">|</span>
          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {p.reading_minutes} min read</span>
        </div>
      </header>

      {p.cover_image && (
        <div className="container-x mt-10 max-w-4xl">
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-sand">
            <Image src={p.cover_image} alt="" fill priority sizes="(max-width: 1024px) 100vw, 1024px" className="object-cover" />
          </div>
        </div>
      )}

      <div className="container-x mt-12 max-w-4xl">
        <div className="prose prose-lg prose-decor max-w-none">
          <Markdown>{p.content ?? ""}</Markdown>
        </div>

        <div className="mt-12 flex flex-col gap-6 border-y border-line py-6 sm:flex-row sm:items-center sm:justify-between">
          {p.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {p.tags.map((t) => (
                <Link key={t} href={`/blog?tag=${encodeURIComponent(t)}`} className="rounded-full bg-sand px-3 py-1 text-xs text-cocoa hover:bg-oat">
                  #{t}
                </Link>
              ))}
            </div>
          ) : (
            <span />
          )}
          <ShareButtons title={p.title} />
        </div>

        <aside className="mt-10 flex flex-col items-start gap-5 rounded-2xl bg-sand p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-serif text-2xl font-semibold">Need help choosing?</p>
            <p className="mt-1 text-sm text-stone">Send us your room photos and window sizes — we&apos;ll recommend the perfect fit.</p>
          </div>
          <a
            href={whatsappHref(contact.whatsapp_number, `Hello Chris Moore Interior Decor! I just read "${p.title}" and I'd like some advice.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-whatsapp shrink-0"
          >
            <WhatsAppIcon className="h-4 w-4" /> Chat with a stylist
          </a>
        </aside>

        <Link href="/blog" className="mt-10 inline-flex items-center gap-2 text-sm text-stone hover:text-bronze">
          <ArrowLeft className="h-4 w-4" /> Back to the Journal
        </Link>
      </div>

      {products.length > 0 && (
        <section className="container-x mt-20">
          <p className="eyebrow">Shop the look</p>
          <h2 className="heading mb-8 mt-2 text-3xl sm:text-4xl">Featured in this article</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            {products.map((pr) => (
              <ProductCard key={pr.id} product={pr} />
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="container-x mt-20">
          <p className="eyebrow">Keep reading</p>
          <h2 className="heading mb-8 mt-2 text-3xl sm:text-4xl">More from the Journal</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <PostCard key={r.id} post={r} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
