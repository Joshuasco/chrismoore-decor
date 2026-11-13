"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Clock, Loader2, Lock, Mail } from "lucide-react";
import AuthInput from "@/components/admin/AuthInput";
import Logo from "@/components/store/Logo";
import { PUBLIC_API_URL } from "@/lib/api";
import { setToken, takeLoginNotice } from "@/lib/admin";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // Why the last session ended, or why sign-in was refused (pending/disapproved).
  const [notice, setNotice] = useState("");

  useEffect(() => {
    Promise.resolve(takeLoginNotice()).then((msg) => msg && setNotice(msg));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${PUBLIC_API_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setNotice(data.error || "Your account isn't approved yet.");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Sign in failed");
      setNotice("");
      setToken(data.token);
      toast.success(`Welcome back${data.user?.name ? `, ${data.user.name}` : ""}`);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && next.startsWith("/admin") ? next : "/admin");
    } catch (err) {
      toast.error(err instanceof TypeError ? "Can't reach the API server." : (err as Error).message);
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
          <p className="font-serif text-4xl font-medium leading-tight">Manage your store, inventory and orders in one place.</p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-linen px-6 py-16">
        <form onSubmit={submit} className="w-full max-w-sm">
          <Logo />
          <h1 className="heading mt-10 text-4xl">Dashboard sign in</h1>
          <p className="mt-2 text-sm text-stone">For Chris Moore admins and approved staff.</p>
          {notice && (
            <p role="status" className="mt-6 flex gap-2.5 rounded-lg bg-amber-50 p-3.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" /> {notice}
            </p>
          )}
          <div className="mt-8 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <AuthInput icon={Mail} id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <AuthInput icon={Lock} id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
          </div>
          <button className="btn-primary mt-6 w-full py-3" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
          </button>
          <p className="mt-6 text-center text-sm text-stone">
            New staff member?{" "}
            <Link href="/admin/register" className="font-medium text-bronze hover:text-bronze-dark">Request access</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
