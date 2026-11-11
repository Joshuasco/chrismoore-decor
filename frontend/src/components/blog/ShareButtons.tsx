"use client";

import toast from "react-hot-toast";
import { Link2, Share2 } from "lucide-react";
import { WhatsAppOutlineIcon } from "@/components/store/WhatsAppFab";

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M13.5 21v-7.5h2.53l.38-2.94H13.5V8.69c0-.85.24-1.43 1.46-1.43h1.56V4.63A20.9 20.9 0 0 0 14.25 4.5c-2.25 0-3.79 1.37-3.79 3.89v2.17H7.92v2.94h2.54V21h3.04Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
    </svg>
  );
}

export default function ShareButtons({ title }: { title: string }) {
  const url = () => window.location.href.split("#")[0];
  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer,width=640,height=560");

  const btn = "grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-cocoa transition hover:border-bronze hover:text-bronze";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs uppercase tracking-[0.16em] text-mist">Share</span>
      <button className={btn} aria-label="Share on WhatsApp" onClick={() => open(`https://wa.me/?text=${encodeURIComponent(`${title} — ${url()}`)}`)}>
        <WhatsAppOutlineIcon className="h-4 w-4" />
      </button>
      <button className={btn} aria-label="Share on Facebook" onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`)}>
        <FacebookIcon className="h-4 w-4" />
      </button>
      <button className={btn} aria-label="Share on X" onClick={() => open(`https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url())}`)}>
        <XIcon className="h-3.5 w-3.5" />
      </button>
      <button
        className={btn}
        aria-label="Copy link"
        onClick={() =>
          navigator.clipboard
            .writeText(url())
            .then(() => toast.success("Link copied"))
            .catch(() => toast.error("Couldn't copy the link"))
        }
      >
        <Link2 className="h-4 w-4" />
      </button>
      <button
        className={`${btn} sm:hidden`}
        aria-label="More sharing options"
        onClick={() => {
          if (typeof navigator.share === "function") navigator.share({ title, url: url() }).catch(() => {});
          else navigator.clipboard.writeText(url()).then(() => toast.success("Link copied"), () => toast.error("Couldn't copy the link"));
        }}
      >
        <Share2 className="h-4 w-4" />
      </button>
    </div>
  );
}
