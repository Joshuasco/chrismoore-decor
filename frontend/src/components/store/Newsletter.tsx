"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { ApiError, apiFetch } from "@/lib/api";
import { DEMO_ENABLED } from "@/lib/demo";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/newsletter", { method: "POST", body: JSON.stringify({ email }) });
      toast.success("You're on the list! Look out for styling tips and offers.");
      setEmail("");
    } catch (err) {
      // Demo mode: no API to store the address, but keep the experience complete.
      if (DEMO_ENABLED && err instanceof ApiError && (err.status === 0 || err.status >= 500)) {
        toast.success("Thanks for subscribing! (Demo mode — your email wasn't stored.)");
        setEmail("");
        return;
      }
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
      <label htmlFor="nl-email" className="sr-only">Email address</label>
      <input
        id="nl-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        className="input flex-1"
      />
      <button className="btn-primary whitespace-nowrap" disabled={loading}>
        {loading ? "Subscribing…" : "Subscribe"}
      </button>
    </form>
  );
}
