import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { WhatsAppOutlineIcon } from "./WhatsAppFab";
import { formatIntlPhone, mapsSearchHref, telHref, whatsappHref } from "@/lib/contact";
import Logo from "./Logo";
import Newsletter from "./Newsletter";
import type { Category, StoreSettings } from "@/lib/types";

export default function Footer({ settings, categories }: { settings: StoreSettings; categories: Category[] }) {
  return (
    <footer className="mt-24">
      <section className="relative overflow-hidden bg-sand">
        <div className="container-x relative grid items-center gap-8 py-14 md:grid-cols-[1fr_auto]">
          <div>
            <p className="eyebrow">Stay inspired</p>
            <h2 className="heading mt-2 text-3xl sm:text-4xl">Let&apos;s dress your home beautifully</h2>
            <p className="mt-2 max-w-lg text-sm text-stone">
              Subscribe for new arrivals, styling ideas and members-only offers on curtains, bedding, blinds and rugs.
            </p>
          </div>
          <Newsletter />
        </div>
      </section>

      <div className="bg-cream">
        <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-stone">
              Curtains, bedding, blinds and rugs chosen to make every room feel finished, calm and personal.
            </p>
          </div>
          <div>
            <h3 className="eyebrow mb-4 text-ink">Shop</h3>
            <ul className="space-y-2.5 text-sm text-stone">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={`/shop?category=${c.slug}`} className="hover:text-bronze">{c.name}</Link>
                </li>
              ))}
              <li><Link href="/shop" className="hover:text-bronze">All Products</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="eyebrow mb-4 text-ink">Customer care</h3>
            <ul className="space-y-2.5 text-sm text-stone">
              <li><Link href="/cart" className="hover:text-bronze">Your Cart</Link></li>
              <li><Link href="/contact" className="hover:text-bronze">Measurement & Installation</Link></li>
              <li><Link href="/contact" className="hover:text-bronze">Delivery & Returns</Link></li>
              <li><Link href="/blog" className="hover:text-bronze">Blog & Guides</Link></li>
              <li><Link href="/about" className="hover:text-bronze">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-bronze">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="eyebrow mb-4 text-ink">Contact</h3>
            <ul className="space-y-4 text-sm text-stone">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-bronze" />
                <span>
                  <a href={mapsSearchHref(settings.address)} target="_blank" rel="noopener noreferrer" aria-label={`Address: ${settings.address} (opens Google Maps)`} className="leading-relaxed hover:text-bronze">
                    {settings.address}
                  </a>
                </span>
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-bronze" />
                <span>
                  <a href={telHref(settings.contact_phone)} aria-label={`Call ${settings.contact_phone}`} className="hover:text-bronze">{settings.contact_phone}</a>
                </span>
              </li>
              <li className="flex gap-3">
                <WhatsAppOutlineIcon className="mt-0.5 h-4 w-4 shrink-0 text-bronze" />
                <span>
                  <a href={whatsappHref(settings.whatsapp_number)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${formatIntlPhone(settings.whatsapp_number)}`} className="hover:text-bronze">
                    {formatIntlPhone(settings.whatsapp_number)}
                  </a>
                </span>
              </li>
              <li className="flex gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-bronze" />
                <span><span className="sr-only">Opening days: </span>{settings.opening_hours}</span>
              </li>
              {settings.contact_email && (
                <li className="flex gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-bronze" />
                  <span>
                    <a href={`mailto:${settings.contact_email}`} className="hover:text-bronze">{settings.contact_email}</a>
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-line">
          <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-mist sm:flex-row">
            <p>© {new Date().getFullYear()} {settings.store_name || "Chris Moore Interior Decor"}. All rights reserved.</p>
            <p>Secure payments by Paystack & Flutterwave</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
