import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CreditCard, Headset, Ruler, Truck } from "lucide-react";
import ProductCard from "@/components/store/ProductCard";
import SectionHeading from "@/components/store/SectionHeading";
import { WhatsAppIcon } from "@/components/store/WhatsAppFab";
import { getCategories, getPosts, getProducts, getSettings } from "@/lib/api";
import { formatNaira } from "@/lib/format";

const img = (id: string, w = 1600) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

const HERO = img("photo-1583847268964-b28dc8f51f92", 2000);

const highlights = [
  {
    title: "Curtains & Accessories",
    text: "Blackout, sheer and lined drapes with rods and tiebacks to match.",
    image: img("photo-1629140727571-9b5c6f6267b4", 300),
    href: "/shop?category=curtains",
  },
  {
    title: "Luxury Bed Sheets",
    text: "Egyptian cotton, linen and satin sets for restful nights.",
    image: img("photo-1617325247661-675ab4b64ae2", 300),
    href: "/shop?category=bed-sheets",
  },
  {
    title: "Blinds & Rugs",
    text: "Made-to-measure vertical blinds and rugs that ground a room.",
    image: img("photo-1594040226829-7f251ab46d80", 300),
    href: "/shop?category=vertical-blinds",
  },
];

const trust = [
  { icon: Truck, title: "Nationwide Delivery", text: "Fast dispatch across Nigeria" },
  { icon: Ruler, title: "Made to Measure", text: "Free measuring advice" },
  { icon: CreditCard, title: "Secure Payments", text: "Paystack & Flutterwave" },
  { icon: Headset, title: "WhatsApp Support", text: "Real people, quick replies" },
];

const ideas = [
  {
    title: "How to measure your windows for curtains",
    date: "Styling guide",
    image: img("photo-1617104678098-de229db51175", 800),
  },
  {
    title: "Choosing a rug size for every room",
    date: "Room guide",
    image: img("photo-1616486338812-3dadae4b4ace", 800),
  },
  {
    title: "Thread count, linen or sateen? A bedding guide",
    date: "Bedroom",
    image: img("photo-1595526114035-0d45ed16cfbf", 800),
  },
];

export default async function HomePage() {
  const [settings, categories, featured, latest, posts] = await Promise.all([
    getSettings(),
    getCategories(),
    getProducts({ featured: true, sort: "popular", limit: 8 }),
    getProducts({ sort: "newest", limit: 3 }),
    getPosts({ limit: 3 }),
  ]);
  // Latest journal posts; fall back to static ideas if the blog is empty.
  const ideaCards = posts.items.length
    ? posts.items.map((p) => ({ title: p.title, date: p.category, image: p.cover_image, href: `/blog/${p.slug}` }))
    : ideas.map((i) => ({ ...i, href: "/blog" }));

  const wa = settings.whatsapp_number
    ? `https://wa.me/${settings.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(
        "Hello Chris Moore Interior Decor! I'd like help choosing curtains/blinds for my home.",
      )}`
    : "/contact";

  return (
    <>
      {/* HERO */}
      <section className="relative isolate">
        <div className="relative h-[620px] w-full overflow-hidden sm:h-[640px] lg:h-[680px]">
          <Image src={HERO} alt="Living room dressed with floor-length linen curtains" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-linen via-linen/80 to-transparent sm:via-linen/60" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink/25 to-transparent" />
        </div>
        <div className="container-x absolute inset-0 flex items-center pb-24">
          <div className="max-w-xl">
            <p className="eyebrow text-cocoa">Tailored windows · Restful beds · Soft floors</p>
            <h1 className="heading mt-5 text-5xl sm:text-6xl lg:text-7xl">
              Dress Every Room
              <span className="block italic text-bronze">Like Home</span>
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-cocoa">
              Curtains & accessories, luxury bed sheets, vertical blinds and rugs — curated, measured and delivered by
              Chris Moore Interior Decor.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className="btn-primary px-8">
                Shop Collection <ArrowRight className="h-4 w-4" />
              </Link>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-outline bg-white/40 backdrop-blur">
                <WhatsAppIcon className="h-4 w-4" /> Order on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* OVERLAPPING HIGHLIGHT CARDS */}
      <section className="container-x relative z-10 -mt-28 grid gap-4 sm:-mt-24 md:grid-cols-3 md:gap-6">
        {highlights.map((h) => (
          <div key={h.title} className="card flex items-center gap-5 p-5 transition hover:-translate-y-1 hover:shadow-lift">
            <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-sand">
              <Image src={h.image} alt="" fill sizes="80px" className="object-cover" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-semibold">{h.title}</h3>
              <p className="mt-1 text-[13px] leading-snug text-stone">{h.text}</p>
              <Link href={h.href} className="btn-primary btn-sm mt-3 uppercase tracking-wider">
                Shop now
              </Link>
            </div>
          </div>
        ))}
      </section>

      {/* TRUST BAR */}
      <section className="container-x mt-12">
        <div className="grid grid-cols-2 divide-line rounded-xl border border-line bg-cream lg:grid-cols-4 lg:divide-x">
          {trust.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-3 p-5 sm:justify-center">
              <Icon className="h-6 w-6 shrink-0 text-bronze" strokeWidth={1.4} />
              <div>
                <p className="text-[13px] font-medium">{title}</p>
                <p className="text-xs text-stone">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SHOP BY CATEGORY */}
      {categories.length > 0 && (
        <section className="container-x mt-24">
          <SectionHeading eyebrow="Shop by category" title={<>Everything Your Rooms Need</>} href="/shop" linkLabel="View all products" />
          <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/shop?category=${c.slug}`}
                className="group relative aspect-[3/3.6] w-[64%] shrink-0 snap-start overflow-hidden rounded-xl bg-sand sm:w-auto"
              >
                {c.image_url && (
                  <Image src={c.image_url} alt={c.name} fill sizes="(max-width: 640px) 64vw, 20vw" className="object-cover transition duration-700 group-hover:scale-105" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-center text-white">
                  <p className="font-serif text-xl font-semibold">{c.name}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/80">{c.product_count} items</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CUSTOMER FAVOURITES */}
      <section className="container-x mt-24">
        <SectionHeading eyebrow="Bestsellers" title="Customer Favourites" href="/shop?sort=popular" linkLabel="View all products" />
        {featured.items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            {featured.items.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-stone">
            Products will appear here once the store API is running.
          </p>
        )}
      </section>

      {/* MADE-TO-MEASURE BANNER */}
      <section className="container-x mt-24">
        <div className="relative overflow-hidden rounded-2xl bg-sand">
          <div className="grid items-center md:grid-cols-2">
            <div className="relative z-10 p-8 sm:p-12 lg:p-16">
              <p className="eyebrow">Made to measure</p>
              <h2 className="heading mt-3 text-4xl sm:text-5xl">
                Perfect Fit.
                <span className="block">Beautiful Finish.</span>
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone">
                Send us your window sizes on WhatsApp and we&apos;ll recommend fabrics, headings and blinds — then deliver
                everything ready to hang.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                  <WhatsAppIcon className="h-4 w-4" /> Get a free quote
                </a>
                <Link href="/shop?category=vertical-blinds" className="btn-outline">Explore blinds</Link>
              </div>
            </div>
            <div className="relative h-72 md:h-full md:min-h-[420px]">
              <Image src={img("photo-1616137466211-f939a420be84", 1200)} alt="Window with blinds in a bright room" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* LATEST ARRIVALS */}
      {latest.items.length > 0 && (
        <section className="relative mt-24 overflow-hidden">
          <Image src={img("photo-1578898886225-c7c894047899", 2000)} alt="" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-cream/75" />
          <div className="container-x relative grid items-center gap-10 py-20 lg:grid-cols-[1fr_2fr]">
            <div>
              <p className="eyebrow">Just in</p>
              <h2 className="heading mt-2 text-4xl sm:text-5xl">Latest Arrivals</h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-bronze-dark">
                Fresh fabrics, new colourways and rugs we can&apos;t stop talking about — added to the collection this season.
              </p>
              <Link href="/shop?sort=newest" className="btn-primary mt-7 px-8">Get Inspired</Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {latest.items.map((p) => (
                <Link key={p.id} href={`/product/${p.slug}`} className="group overflow-hidden rounded-lg bg-white shadow-card transition hover:-translate-y-1 hover:shadow-lift">
                  <div className="relative aspect-[4/3.3] overflow-hidden bg-sand">
                    {p.images[0] && <Image src={p.images[0]} alt={p.name} fill sizes="(max-width: 640px) 100vw, 22vw" className="object-cover transition duration-700 group-hover:scale-105" />}
                  </div>
                  <div className="p-4 text-center">
                    <p className="font-serif text-lg font-semibold leading-snug">{p.name}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-bronze-dark">{p.short_description}</p>
                    <p className="mt-2 text-sm font-semibold">{formatNaira(p.price)}</p>
                    <span className="btn-primary btn-sm mt-3 w-full">View Product</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* IDEAS */}
      <section className="container-x mt-24">
        <div className="grid gap-8 rounded-2xl bg-cream p-6 sm:p-10 lg:grid-cols-[1fr_3fr]">
          <div className="flex flex-col justify-center">
            <p className="eyebrow">Design tips & ideas</p>
            <h2 className="heading mt-2 text-3xl">Inspiration for a home you&apos;ll love</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone">
              Guides from our stylists on measuring, layering and choosing the right textiles.
            </p>
            <Link href="/blog" className="btn-dark mt-6 w-fit">Read the blog</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {ideaCards.map((idea) => (
              <Link key={idea.title} href={idea.href} className="group overflow-hidden rounded-lg bg-white transition hover:shadow-card">
                <div className="relative aspect-[4/3] overflow-hidden bg-sand">
                  {idea.image && <Image src={idea.image} alt="" fill sizes="(max-width: 640px) 100vw, 25vw" className="object-cover transition duration-700 group-hover:scale-105" />}
                </div>
                <div className="p-4">
                  <h3 className="font-serif text-lg font-semibold leading-snug group-hover:text-bronze-dark">{idea.title}</h3>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-mist">{idea.date}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
