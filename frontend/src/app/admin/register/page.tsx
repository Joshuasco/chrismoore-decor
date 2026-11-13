"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { Check, CheckCircle2, Loader2, Lock, Mail, User, X } from "lucide-react";
import AuthInput from "@/components/admin/AuthInput";
import Logo from "@/components/store/Logo";
import { PUBLIC_API_URL } from "@/lib/api";
import { cn } from "@/lib/format";

export default function StaffRegister() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  // Checked as the user types, so problems show before they submit.
  const pwLength = form.password.length;
  const pwTooShort = pwLength > 0 && pwLength < 8;
  const confirmTyped = form.confirm.length > 0;
  const matches = confirmTyped && form.password === form.confirm;
  const mismatch = confirmTyped && !matches;
  const canSubmit = pwLength >= 8 && matches;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await fetch(`${PUBLIC_API_URL}/api/admin/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't send your request");
      setDone(form.email.trim());
    } catch (err) {
      toast.error(err instanceof TypeError ? "Can't reach the API server." : (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <Image
          src="https://images.unsplash.com/photo-1617104551722-3b2d51366400?w=1600&q=80&auto=format&fit=crop"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-ink/40" />
        <div className="absolute bottom-12 left-12 max-w-sm text-white">
          <p className="font-serif text-4xl font-medium leading-tight">Join the Chris Moore team dashboard.</p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-linen px-6 py-16">
        {done ? (
          <div className="w-full max-w-sm">
            <Logo />
            <CheckCircle2 className="mt-10 h-12 w-12 text-whatsapp" />
            <h1 className="heading mt-4 text-4xl">Request sent</h1>
            <p className="mt-3 text-sm leading-relaxed text-stone">
              Your account <span className="font-medium text-ink">{done}</span> is waiting for an administrator to approve it. Once approved, you can sign in
              and use the sections your group has access to.
            </p>
            <Link href="/admin/login" className="btn-primary mt-8 w-full py-3">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="w-full max-w-sm">
            <Logo />
            <h1 className="heading mt-10 text-4xl">Request staff access</h1>
            <p className="mt-2 text-sm text-stone">An administrator will review your request before you can sign in.</p>
            <div className="mt-8 space-y-4">
              <div>
                <label className="label" htmlFor="name">Full name</label>
                <AuthInput icon={User} id="name" required maxLength={80} value={form.name} onChange={set("name")} autoComplete="name" />
              </div>
              <div>
                <label className="label" htmlFor="email">Work email</label>
                <AuthInput icon={Mail} id="email" type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <AuthInput
                  icon={Lock}
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={72}
                  className={cn(pwTooShort && "border-red-300 focus:border-red-400")}
                  value={form.password}
                  onChange={set("password")}
                  autoComplete="new-password"
                  aria-describedby="password-hint"
                  aria-invalid={pwTooShort}
                />
                <p id="password-hint" className={cn("mt-1 flex items-center gap-1 text-xs", pwTooShort ? "text-red-700" : pwLength >= 8 ? "text-emerald-700" : "text-mist")}>
                  {pwLength >= 8 && <Check className="h-3.5 w-3.5" />}
                  {pwTooShort ? `At least 8 characters (${8 - pwLength} more)` : "At least 8 characters"}
                </p>
              </div>
              <div>
                <label className="label" htmlFor="confirm">Confirm password</label>
                <AuthInput
                  icon={Lock}
                  id="confirm"
                  type="password"
                  required
                  maxLength={72}
                  className={cn(mismatch && "border-red-300 focus:border-red-400", matches && "border-emerald-300 focus:border-emerald-400")}
                  value={form.confirm}
                  onChange={set("confirm")}
                  autoComplete="new-password"
                  aria-describedby="confirm-hint"
                  aria-invalid={mismatch}
                />
                <p id="confirm-hint" aria-live="polite" className="mt-1 min-h-4 text-xs">
                  {mismatch && <span className="flex items-center gap-1 text-red-700"><X className="h-3.5 w-3.5" /> Passwords don&apos;t match</span>}
                  {matches && <span className="flex items-center gap-1 text-emerald-700"><Check className="h-3.5 w-3.5" /> Passwords match</span>}
                </p>
              </div>
            </div>
            <button className="btn-primary mt-6 w-full py-3" disabled={loading || !canSubmit}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Send request
            </button>
            <p className="mt-6 text-center text-sm text-stone">
              Already approved?{" "}
              <Link href="/admin/login" className="font-medium text-bronze hover:text-bronze-dark">Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
