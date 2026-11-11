"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PostForm from "@/components/admin/PostForm";
import { PageHeader } from "@/components/admin/ui";

export default function NewPost() {
  return (
    <>
      <Link href="/admin/blog" className="mb-4 inline-flex items-center gap-1.5 text-sm text-stone hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Blog
      </Link>
      <PageHeader title="New post" />
      <PostForm />
    </>
  );
}
