import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function SectionHeading({
  eyebrow,
  title,
  href,
  linkLabel,
  center = false,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  href?: string;
  linkLabel?: string;
  center?: boolean;
}) {
  if (center) {
    return (
      <div className="mb-10 text-center">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="heading mt-2 text-3xl sm:text-4xl">{title}</h2>
        <span className="mx-auto mt-4 block h-px w-12 bg-bronze" />
      </div>
    );
  }
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="heading mt-2 max-w-md text-3xl sm:text-4xl">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="group flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-bronze hover:text-bronze-dark">
          {linkLabel} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
