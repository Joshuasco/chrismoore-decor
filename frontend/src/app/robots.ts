import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/api";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/checkout", "/cart", "/order/", "/payment/", "/invoice/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
