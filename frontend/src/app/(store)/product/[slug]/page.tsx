import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCard, Ruler, Truck } from "lucide-react";
import ProductCard from "@/components/store/ProductCard";
import ProductGallery from "@/components/store/ProductGallery";
import ProductPurchase from "@/components/store/ProductPurchase";
import ProductReviews from "@/components/store/ProductReviews";
import Stars from "@/components/store/Stars";
import { getProduct, getReviews, getSettings } from "@/lib/api";
import { formatNaira } from "@/lib/format";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProduct(slug).catch(() => null);
  if (!data) return { title: "Product not found" };
  return {
    title: data.product.name,
    description: data.product.short_description,
    openGraph: { images: data.product.images.slice(0, 1) },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [data, settings] = await Promise.all([getProduct(slug), getSettings()]);
  if (!data) notFound();
  const { product: p, related } = data;
  const reviews = await getReviews(p.slug, p.id, { limit: 5 });
  const onSale = p.compare_at_price && p.compare_at_price > p.price;

  const details = [
    { title: "Description", body: p.description },
    { title: "Material & care", body: `${p.material || "Premium materials"}. Follow the care label; we recommend gentle washing or professional cleaning for lined and velvet pieces.` },
    { title: "Delivery & returns", body: "Dispatched within 1–3 working days in Lagos and 3–7 days nationwide. Made-to-measure items are produced to order. Unused items can be returned within 7 days." },
  ];

  return (
    <>
      <div className="container-x pt-8">
        <nav className="text-xs text-mist" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-bronze">Home</Link> / <Link href="/shop" className="hover:text-bronze">Shop</Link>
          {p.category_slug && (
            <> / <Link href={`/shop?category=${p.category_slug}`} className="hover:text-bronze">{p.category_name}</Link></>
          )}
        </nav>
      </div>

      <section className="container-x mt-6 grid gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Desktop: the gallery stays pinned while the details scroll; when the details end,
            the grid row ends, so both bottoms align and scroll away with the page together. */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ProductGallery images={p.images} name={p.name} />
        </div>

        <div>
          <p className="eyebrow">{p.category_name}</p>
          <h1 className="heading mt-2 text-4xl sm:text-5xl">{p.name}</h1>
          {/* Same rating/count as the product card: both come from the approved reviews below. */}
          <a href="#reviews" className="group mt-3 flex w-fit items-center gap-3">
            <Stars rating={p.rating} size={15} />
            <span className="text-sm text-stone underline-offset-4 group-hover:text-bronze group-hover:underline">
              {p.review_count > 0
                ? `${p.rating.toFixed(1)} · ${p.review_count} ${p.review_count === 1 ? "review" : "reviews"}`
                : "No reviews yet — write the first"}
            </span>
          </a>
          <div className="mt-5 flex items-baseline gap-3">
            <p className="text-3xl font-semibold">{formatNaira(p.price)}</p>
            {onSale && <p className="text-lg text-mist line-through">{formatNaira(p.compare_at_price!)}</p>}
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-stone">{p.short_description}</p>
          <p className="mt-1 text-xs text-mist">SKU: {p.sku}</p>

          <div className="mt-8 border-t border-line pt-8">
            <ProductPurchase product={p} whatsappNumber={settings.whatsapp_number} />
          </div>

          <ul className="mt-8 grid gap-3 rounded-xl bg-cream p-5 text-sm sm:grid-cols-3">
            <li className="flex items-center gap-2"><Truck className="h-4 w-4 text-bronze" /> Nationwide delivery</li>
            <li className="flex items-center gap-2"><Ruler className="h-4 w-4 text-bronze" /> Measuring advice</li>
            <li className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-bronze" /> Secure checkout</li>
          </ul>

          <div className="mt-8 divide-y divide-line border-y border-line">
            {details.map((d, i) => (
              <details key={d.title} open={i === 0} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between font-serif text-lg font-semibold">
                  {d.title}
                  <span className="text-xl text-bronze transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-stone">{d.body}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <ProductReviews productId={p.id} slug={p.slug} productName={p.name} initial={reviews} />

      {related.length > 0 && (
        <section className="container-x mt-24">
          <p className="eyebrow">You may also like</p>
          <h2 className="heading mb-8 mt-2 text-3xl sm:text-4xl">Complete the Look</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
