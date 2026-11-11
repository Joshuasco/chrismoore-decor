import type { Metadata } from "next";
import PaymentCallback from "@/components/store/PaymentCallback";

export const metadata: Metadata = { title: "Confirming payment", robots: { index: false } };

export default async function PaymentCallbackPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  // Paystack appends ?reference=&trxref=, Flutterwave appends ?status=&tx_ref=&transaction_id=
  const reference = sp.reference || sp.trxref || sp.tx_ref || "";
  return <PaymentCallback reference={reference} order={sp.order || ""} status={sp.status || ""} />;
}
