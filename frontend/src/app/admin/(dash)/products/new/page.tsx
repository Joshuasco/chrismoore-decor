"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ProductForm from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";

export default function NewProduct() {
  return (
    <>
      <Link href="/admin/products" className="mb-4 inline-flex items-center gap-1.5 text-sm text-stone hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Products
      </Link>
      <PageHeader title="New product" />
      <ProductForm />
    </>
  );
}
