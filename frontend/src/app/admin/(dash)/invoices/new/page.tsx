"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import InvoiceForm from "@/components/admin/InvoiceForm";
import { PageHeader } from "@/components/admin/ui";

export default function NewInvoicePage() {
  const router = useRouter();
  return (
    <>
      <Link href="/admin/invoices" className="mb-4 inline-flex items-center gap-1.5 text-sm text-stone hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Invoices
      </Link>
      <PageHeader title="New invoice" subtitle="Add the customer and items. You'll get a payment link to share right after." />
      <InvoiceForm
        onSaved={(d) => {
          toast.success(`${d.invoice.number} created. Share the payment link with your customer.`);
          router.replace(`/admin/invoices/${d.invoice.id}`);
        }}
      />
    </>
  );
}
