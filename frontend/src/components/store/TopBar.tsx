import { Phone, RotateCcw, Truck } from "lucide-react";

export default function TopBar({ announcement, phone }: { announcement?: string; phone?: string }) {
  return (
    <div className="bg-ink text-[12px] text-white/85">
      <div className="container-x flex h-9 items-center justify-center gap-6 md:justify-between">
        <p className="flex items-center gap-2 truncate">
          <Truck className="h-3.5 w-3.5 shrink-0 text-bronze-light" />
          <span className="truncate">{announcement || "Nationwide delivery across Nigeria"}</span>
        </p>
        <p className="hidden items-center gap-2 lg:flex">
          <RotateCcw className="h-3.5 w-3.5 text-bronze-light" /> Free measurement & fitting advice
        </p>
        {phone && (
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="hidden items-center gap-2 hover:text-white md:flex">
            <Phone className="h-3.5 w-3.5 text-bronze-light" /> Need help? {phone}
          </a>
        )}
      </div>
    </div>
  );
}
