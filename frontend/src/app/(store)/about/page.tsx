import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "About Us" };

const img = (id: string, w = 1400) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

export default function AboutPage() {
  return (
    <>
      <section className="bg-cream">
        <div className="container-x grid items-center gap-10 py-16 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Our story</p>
            <h1 className="heading mt-3 text-5xl">
              Soft furnishings, <span className="italic text-bronze">thoughtfully chosen</span>
            </h1>
            <p className="mt-6 text-[15px] leading-relaxed text-stone">
              Chris Moore Interior Decor sells and supplies curtains and accessories, bed sheets, vertical blinds and rugs to
              homes, offices and hospitality spaces. We combine quality fabrics with practical advice — from measuring your
              windows to choosing the right thread count — so every room feels finished.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-stone">
              Whether you&apos;re dressing a single bedroom or fitting out an entire building, our team is a WhatsApp message away.
            </p>
            <Link href="/shop" className="btn-primary mt-8">Shop the collection</Link>
          </div>
          <div className="relative aspect-[4/3.4] overflow-hidden rounded-2xl">
            <Image src={img("photo-1600121848594-d8644e57abab")} alt="Living room with curtains and a rug" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          </div>
        </div>
      </section>
      <section className="container-x mt-20 grid gap-6 sm:grid-cols-3">
        {[
          ["Retail & supply", "Ready-made pieces for your home and bulk supply for hotels, offices and developers."],
          ["Made to measure", "Curtains and vertical blinds cut to your exact window sizes."],
          ["Personal service", "Order and get styling advice directly on WhatsApp."],
        ].map(([t, d]) => (
          <div key={t} className="card p-8">
            <h2 className="font-serif text-2xl font-semibold">{t}</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone">{d}</p>
          </div>
        ))}
      </section>
    </>
  );
}
