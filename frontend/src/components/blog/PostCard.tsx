import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { BlogPost } from "@/lib/types";

export default function PostCard({ post, priority = false }: { post: BlogPost; priority?: boolean }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl bg-white shadow-card transition-shadow duration-300 hover:shadow-lift">
      <Link href={`/blog/${post.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-sand">
        {post.cover_image && (
          <Image
            src={post.cover_image}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}
        <span className="absolute left-3 top-3 rounded bg-white/95 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-bronze-dark">
          {post.category}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-mist">
          {post.published_at && <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>}
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {post.reading_minutes} min read</span>
        </p>
        <h3 className="mt-2 font-serif text-[22px] font-semibold leading-snug">
          <Link href={`/blog/${post.slug}`} className="hover:text-bronze-dark">{post.title}</Link>
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone">{post.excerpt}</p>
        <Link
          href={`/blog/${post.slug}`}
          className="mt-auto flex items-center gap-2 pt-5 text-[11px] font-medium uppercase tracking-[0.18em] text-bronze hover:text-bronze-dark"
          aria-label={`Read ${post.title}`}
        >
          Read article <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
        </Link>
      </div>
    </article>
  );
}
