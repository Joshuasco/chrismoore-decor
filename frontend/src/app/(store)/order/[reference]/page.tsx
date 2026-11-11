import type { Metadata } from "next";
import OrderView from "@/components/store/OrderView";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ reference }, sp] = await Promise.all([params, searchParams]);
  return <OrderView reference={reference} isNew={sp.new === "1"} />;
}
