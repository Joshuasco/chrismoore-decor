import type { Metadata } from "next";
import { Clock, ExternalLink, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/store/WhatsAppFab";
import { getSettings } from "@/lib/api";
import { formatIntlPhone as formatIntl, mapsEmbedSrc, mapsSearchHref, telHref, whatsappHref, withContactDefaults } from "@/lib/contact";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const s = withContactDefaults(await getSettings());
  const wa = s.whatsapp_number.replace(/\D/g, "");
  const waLink = whatsappHref(wa, "Hello Chris Moore Interior Decor, I'd like to make an enquiry.");
  const mapLink = mapsSearchHref(s.address);

  const cards = [
    { icon: <WhatsAppIcon className="h-6 w-6" />, tone: "bg-whatsapp/10 text-whatsapp", title: "WhatsApp", value: formatIntl(wa), href: waLink, cta: "Chat with us", external: true },
    { icon: <Phone className="h-6 w-6" />, tone: "bg-bronze/10 text-bronze", title: "Call us", value: s.contact_phone, href: telHref(s.contact_phone), cta: "Call now" },
    { icon: <Clock className="h-6 w-6" />, tone: "bg-bronze/10 text-bronze", title: "Opening days", value: s.opening_hours },
    ...(s.contact_email
      ? [{ icon: <Mail className="h-6 w-6" />, tone: "bg-bronze/10 text-bronze", title: "Email", value: s.contact_email, href: `mailto:${s.contact_email}`, cta: "Send an email" }]
      : []),
  ];

  return (
    <section className="container-x py-16">
      <p className="eyebrow">Get in touch</p>
      <h1 className="heading mt-3 text-5xl">We&apos;d love to help</h1>
      <p className="mt-4 max-w-xl text-[15px] text-stone">
        Questions about sizes, fabrics, bulk supply or installation? Message us on WhatsApp for the fastest reply, call us, or
        visit our shop in Wuse Modern Market, Abuja.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Showroom */}
        <div className="card flex flex-col p-8">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-bronze/10 text-bronze">
            <MapPin className="h-6 w-6" />
          </span>
          <p className="eyebrow mt-6">Visit our shop</p>
          <address className="mt-2 font-serif text-2xl font-semibold not-italic leading-snug">
            {s.address.split(", ").reduce<React.ReactNode[]>((acc, part, i, arr) => {
              acc.push(part + (i < arr.length - 1 ? "," : ""));
              if (i < arr.length - 1) acc.push(i === 1 || i === 3 ? <br key={i} /> : " ");
              return acc;
            }, [])}
          </address>
          <p className="mt-4 flex items-center gap-2 text-sm text-stone">
            <Clock className="h-4 w-4 text-bronze" /> {s.opening_hours}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={mapLink} target="_blank" rel="noopener noreferrer" className="btn-primary">
              <Navigation className="h-4 w-4" /> Get directions
            </a>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
              <WhatsAppIcon className="h-4 w-4" /> Chat on WhatsApp
            </a>
          </div>
        </div>

        {/* Quick contacts */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {cards.map((c) => {
            const body = (
              <>
                <span className={`grid h-11 w-11 place-items-center rounded-full ${c.tone}`}>{c.icon}</span>
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-mist">{c.title}</p>
                <p className="mt-1 font-medium text-ink">{c.value}</p>
                {c.cta && <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-bronze">{c.cta} →</p>}
              </>
            );
            return c.href ? (
              <a
                key={c.title}
                href={c.href}
                {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="card p-6 transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                {body}
              </a>
            ) : (
              <div key={c.title} className="card p-6">{body}</div>
            );
          })}
        </div>
      </div>

      {/* Map */}
      <div className="mt-10 overflow-hidden rounded-2xl border border-line bg-sand shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-6 py-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-bronze" /> Wuse Modern Market, Abuja
          </p>
          <a href={mapLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-bronze hover:text-bronze-dark">
            Open in Google Maps <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <iframe
          title={`Map showing ${s.address}`}
          src={mapsEmbedSrc(s.address)}
          className="block h-[380px] w-full border-0 sm:h-[460px]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    </section>
  );
}
