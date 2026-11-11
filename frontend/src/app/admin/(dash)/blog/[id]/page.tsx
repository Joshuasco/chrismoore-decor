"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import PostForm from "@/components/admin/PostForm";
import { PageHeader, Spinner } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";
import type { BlogPost } from "@/lib/types";

export default function EditPost() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch<BlogPost>(`/blog/${id}`).then(setPost).catch((e) => setError(e.message));
  }, [id]);

  return (
    <>
      <Link href="/admin/blog" className="mb-4 inline-flex items-center gap-1.5 text-sm text-stone hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Blog
      </Link>
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : !post ? (
        <Spinner />
      ) : (
        <>
          <PageHeader title="Edit post" subtitle={post.title} />
          <PostForm key={post.updated_at} post={post} />
        </>
      )}
    </>
  );
}
