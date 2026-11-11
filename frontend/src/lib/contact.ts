import type { StoreSettings } from "./types";

// Store contact details. Live values come from Admin → Settings; these are
// used when a setting is empty or the API is unreachable.
export const CONTACT_DEFAULTS = {
  address: "Block B34, Shop No. 2, New Extension, Wuse Modern Market, F.C.T, Abuja, Nigeria",
  contact_phone: "0703 963 0895",
  whatsapp_number: "2347039630895",
  opening_hours: "Always open",
};

export function withContactDefaults(settings: StoreSettings): StoreSettings {
  const filled = Object.fromEntries(Object.entries(settings).filter(([, v]) => v));
  return { ...CONTACT_DEFAULTS, ...filled };
}

/** 2347039630895 -> +234 703 963 0895 */
export function formatIntlPhone(digits: string) {
  const d = digits.replace(/\D/g, "");
  return d.startsWith("234") && d.length === 13 ? `+234 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}` : `+${d}`;
}

export const telHref = (phone: string) => `tel:${phone.replace(/\s/g, "")}`;
export const whatsappHref = (number: string, text?: string) =>
  `https://wa.me/${number.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
export const mapsSearchHref = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
export const mapsEmbedSrc = (address: string) =>
  `https://www.google.com/maps?q=${encodeURIComponent(address)}&z=16&output=embed`;
