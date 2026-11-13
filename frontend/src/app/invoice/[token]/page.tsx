import type { Metadata } from "next";
import InvoicePublic from "@/components/invoice/InvoicePublic";

// Invoice links are private to the customer they were sent to.
export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

export default async function InvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InvoicePublic token={token} />;
}
