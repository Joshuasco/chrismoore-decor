"use client";

import { ApiError, PUBLIC_API_URL } from "./api";

const TOKEN_KEY = "cmd-admin-token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

/** Authenticated request to /api/admin/*. Redirects to login on 401. */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${PUBLIC_API_URL}/api/admin${path}`, {
      ...init,
      headers: {
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${getToken() ?? ""}`,
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new ApiError("Can't reach the API server.", 0);
  }
  if (res.status === 401 && !path.startsWith("/login")) {
    setToken(null);
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/admin/login")) {
      window.location.href = `/admin/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  return data as T;
}
