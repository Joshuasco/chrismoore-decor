const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** Formats kobo as naira, e.g. 8500000 -> ₦85,000 */
export function formatNaira(kobo: number) {
  return naira.format(Math.round(kobo) / 100);
}

export function formatDate(iso: string, withTime = false) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos", // the business runs on Lagos time, wherever the server is
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(iso));
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  unpaid: "Unpaid",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  whatsapp: "WhatsApp",
  paystack: "Paystack",
  flutterwave: "Flutterwave",
  approved: "Approved",
  rejected: "Rejected",
  draft: "Draft",
  published: "Published",
  scheduled: "Scheduled",
  disapproved: "Disapproved",
  void: "Void",
  overdue: "Overdue",
  manual: "Marked paid",
  admin: "Admin",
  staff: "Staff",
};

export const NIGERIAN_STATES = [
  "Abia", "Abuja (FCT)", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa", "Kaduna",
  "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];
