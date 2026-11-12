import type { StoreSettings } from "./types";

const PHRASE: Record<string, string> = { email: "email", sms: "SMS", whatsapp: "WhatsApp" };

/**
 * How customers receive their order link, from the API's `notify_channels`
 * setting: "by email, SMS and WhatsApp". Empty when no channel is set up.
 */
export function notifyPhrase(settings: StoreSettings): string {
  const names = (settings.notify_channels || "")
    .split(",")
    .map((c) => PHRASE[c.trim()])
    .filter(Boolean);
  if (names.length === 0) return "";
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return names.length === 1 && names[0] === "WhatsApp" ? "on WhatsApp" : `by ${list}`;
}
