"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** True only after hydration — use it to gate values read from localStorage. */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}
