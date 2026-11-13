"use client";

import { useState } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/format";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> & {
  /** Icon shown inside the field on the left. */
  icon: LucideIcon;
  /** Extra classes for the input, e.g. a red border when invalid. */
  className?: string;
};

/**
 * Text input with a leading icon. Password fields also get a show/hide
 * toggle on the right.
 */
export default function AuthInput({ icon: Icon, className, type = "text", ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" aria-hidden />
      <input {...props} type={isPassword && visible ? "text" : type} className={cn("input pl-10", isPassword && "pr-11", className)} />
      {isPassword && (
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-mist transition hover:bg-sand hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze/30"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={props.id}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
