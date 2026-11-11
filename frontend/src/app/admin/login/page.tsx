"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import Logo from "@/components/store/Logo";
import { PUBLIC_API_URL } from "@/lib/api";
import { setToken } from "@/lib/admin";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
      if (!res.ok) throw new Error(data.error || "Sign in failed");
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
          <h1 className="heading mt-10 text-4xl">Admin sign in</h1>
          <p className="mt-2 text-sm text-stone">Use the admin account configured on the API server.</p>
          <div className="mt-8 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
          </div>
          <button className="btn-primary mt-6 w-full py-3" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
