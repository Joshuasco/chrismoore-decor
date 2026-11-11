"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import ProductForm from "@/components/admin/ProductForm";
import { PageHeader, Spinner } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";
import type { Product } from "@/lib/types";

export default function EditProduct() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Product | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch<Product>(`/products/${id}`).then(setP).catch((e) => setError(e.message));
  }, [id]);

  return (
    <>
      <Link href="/admin/products" className="mb-4 inline-flex items-center gap-1.5 text-sm text-stone hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Products
      </Link>
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : !p ? (
        <Spinner />
      ) : (
        <>
          <PageHeader
            title={p.name}
            subtitle={`SKU ${p.sku}`}
            actions={
              <Link href={`/product/${p.slug}`} target="_blank" className="btn-outline btn-sm">
                <ExternalLink className="h-4 w-4" /> View in store
              </Link>
            }
          />
          <ProductForm key={p.updated_at} product={p} />
        </>
      )}
    </>
  );
}
