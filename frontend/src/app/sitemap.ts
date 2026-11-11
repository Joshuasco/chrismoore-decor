import type { MetadataRoute } from "next";
import { getCategories, getPosts, getProducts, SITE_URL } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products, posts] = await Promise.all([getCategories(), getProducts({ limit: 100 }), getPosts({ limit: 50 })]);
  const page = (path: string, priority: number, lastModified?: string): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    priority,
    ...(lastModified ? { lastModified } : {}),
  });
  return [
    page("/", 1),
    page("/shop", 0.9),
    page("/blog", 0.8),
    page("/about", 0.5),
    page("/contact", 0.6),
    ...categories.map((c) => page(`/shop?category=${c.slug}`, 0.8)),
    ...products.items.map((p) => page(`/product/${p.slug}`, 0.7, p.updated_at)),
    ...posts.items.map((p) => page(`/blog/${p.slug}`, 0.6, p.updated_at)),
  ];
}
