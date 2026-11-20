"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Download,
  Edit,
  Eye,
  FileText,
  Loader2,
  PackageCheck,
  Plus,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { Badge, Empty, Modal, PageHeader, Panel, Spinner } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";
import { cn, formatDate, formatNaira } from "@/lib/format";
import type {
  Product,
  ProcurementPaymentInput,
  ProcurementStats,
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderItemInput,
  PurchaseOrderPage,
  ReceiveGoodsInput,
  Supplier,
  SupplierInput,
  SupplierPage,
} from "@/lib/types";

const PO_STATUS_TABS = [
  { id: "", label: "All POs" },
  { id: "draft", label: "Draft" },
  { id: "ordered", label: "Ordered" },
  { id: "partially_received", label: "Partially Received" },
  { id: "received", label: "Received" },
  { id: "cancelled", label: "Cancelled" },
];

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState<"pos" | "suppliers">("pos");
  const [stats, setStats] = useState<ProcurementStats | null>(null);

  // Purchase Orders state
  const [poData, setPOData] = useState<PurchaseOrderPage | null>(null);
  const [poStatus, setPOStatus] = useState("");
  const [poPaymentStatus, setPOPaymentStatus] = useState("");
  const [poQuery, setPOQuery] = useState("");
  const [poPage, setPOPage] = useState(1);

  // Suppliers state
  const [suppliersData, setSuppliersData] = useState<SupplierPage | null>(null);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);

  // Products for autocomplete in PO
  const [productsList, setProductsList] = useState<Product[]>([]);

  // Modals state
  const [poModalOpen, setPOModalOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);

  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receivePO, setReceivePO] = useState<PurchaseOrder | null>(null);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});
  const [updateCostPrice, setUpdateCostPrice] = useState(true);
  const [receiveNotes, setReceiveNotes] = useState("");

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentPO, setPaymentPO] = useState<PurchaseOrder | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Load stats
  const loadStats = useCallback(() => {
    adminFetch<ProcurementStats>("/procurement/stats").then(setStats).catch(() => {});
  }, []);

  // Load purchase orders
  const loadPOs = useCallback(() => {
    const qs = new URLSearchParams({ page: String(poPage), limit: "20" });
    if (poStatus) qs.set("status", poStatus);
    if (poPaymentStatus) qs.set("payment_status", poPaymentStatus);
    if (poQuery.trim()) qs.set("q", poQuery.trim());
    adminFetch<PurchaseOrderPage>(`/purchase-orders?${qs}`).then(setPOData).catch(() => {});
  }, [poPage, poStatus, poPaymentStatus, poQuery]);

  // Load suppliers
  const loadSuppliers = useCallback(() => {
    const qs = new URLSearchParams({ limit: "50" });
    if (supplierQuery.trim()) qs.set("q", supplierQuery.trim());
    adminFetch<SupplierPage>(`/suppliers?${qs}`).then((page) => {
      setSuppliersData(page);
      if (!supplierQuery) setAllSuppliers(page.items);
    }).catch(() => {});
  }, [supplierQuery]);

  // Load products list for PO creator
  useEffect(() => {
    adminFetch<{ items: Product[] }>("/products?limit=250&sort=name").then((res) => {
      setProductsList(res.items);
    }).catch(() => {});
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const t = setTimeout(loadPOs, 200);
    return () => clearTimeout(t);
  }, [loadPOs]);

  useEffect(() => {
    const t = setTimeout(loadSuppliers, 200);
    return () => clearTimeout(t);
  }, [loadSuppliers]);

  // Helper for kobo conversions
  const kobo = (naira: string | number) => Math.round(Number(naira || 0) * 100);

  // New PO form state
  const [poForm, setPOForm] = useState<{
    supplier_id: string;
    order_date: string;
    expected_delivery_date: string;
    tracking_number: string;
    shipping_carrier: string;
    shipping_cost: string;
    customs_duty: string;
    other_costs: string;
    tax_amount: string;
    notes: string;
    items: Array<{
      product_id: string;
      product_name: string;
      sku: string;
      quantity_ordered: number;
      unit_cost: string; // in naira
    }>;
  }>({
    supplier_id: "",
    order_date: new Date().toISOString().split("T")[0],
    expected_delivery_date: "",
    tracking_number: "",
    shipping_carrier: "",
    shipping_cost: "0",
    customs_duty: "0",
    other_costs: "0",
    tax_amount: "0",
    notes: "",
    items: [{ product_id: "", product_name: "", sku: "", quantity_ordered: 1, unit_cost: "0" }],
  });

  const openNewPO = (supplierId?: string) => {
    setEditingPO(null);
    setPOForm({
      supplier_id: supplierId || (allSuppliers[0]?.id ?? ""),
      order_date: new Date().toISOString().split("T")[0],
      expected_delivery_date: "",
      tracking_number: "",
      shipping_carrier: "",
      shipping_cost: "0",
      customs_duty: "0",
      other_costs: "0",
      tax_amount: "0",
      notes: "",
      items: [{ product_id: "", product_name: "", sku: "", quantity_ordered: 1, unit_cost: "0" }],
    });
    setPOModalOpen(true);
  };

  const openViewPO = async (po: PurchaseOrder) => {
    setViewingPO({
      ...po,
      items: po.items || [],
      payments: po.payments || [],
    });
    try {
      const full = await adminFetch<PurchaseOrder>(`/purchase-orders/${po.id}`);
      if (full && full.id) {
        setViewingPO({
          ...full,
          items: full.items || [],
          payments: full.payments || [],
        });
      }
    } catch {
      // Keep optimistic po
    }
  };

  const openEditPO = async (po: PurchaseOrder) => {
    let target = po;
    if (!target.items || target.items.length === 0) {
      try {
        target = await adminFetch<PurchaseOrder>(`/purchase-orders/${po.id}`);
      } catch {
        target = po;
      }
    }
    setEditingPO(target);
    setPOForm({
      supplier_id: target.supplier_id,
      order_date: target.order_date || "",
      expected_delivery_date: target.expected_delivery_date || "",
      tracking_number: target.tracking_number,
      shipping_carrier: target.shipping_carrier,
      shipping_cost: String(target.shipping_cost / 100),
      customs_duty: String(target.customs_duty / 100),
      other_costs: String(target.other_costs / 100),
      tax_amount: String(target.tax_amount / 100),
      notes: target.notes,
      items: (target.items || []).map((it) => ({
        product_id: it.product_id || "",
        product_name: it.product_name,
        sku: it.sku,
        quantity_ordered: it.quantity_ordered,
        unit_cost: String(it.unit_cost / 100),
      })),
    });
    setPOModalOpen(true);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const prod = productsList.find((p) => p.id === productId);
    setPOForm((prev) => {
      const nextItems = [...prev.items];
      if (prod) {
        nextItems[index] = {
          ...nextItems[index],
          product_id: prod.id,
          product_name: prod.name,
          sku: prod.sku,
          unit_cost: prod.cost_price ? String(prod.cost_price / 100) : nextItems[index].unit_cost,
        };
      } else {
        nextItems[index] = {
          ...nextItems[index],
          product_id: "",
        };
      }
      return { ...prev, items: nextItems };
    });
  };

  const handlePOItemChange = (index: number, field: string, value: string | number) => {
    setPOForm((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return { ...prev, items: nextItems };
    });
  };

  const addPOItem = () => {
    setPOForm((prev) => ({
      ...prev,
      items: [...prev.items, { product_id: "", product_name: "", sku: "", quantity_ordered: 1, unit_cost: "0" }],
    }));
  };

  const removePOItem = (index: number) => {
    if (poForm.items.length <= 1) return;
    setPOForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const calculatePOSubtotal = () => {
    return poForm.items.reduce((acc, it) => acc + (Number(it.unit_cost || 0) * (Number(it.quantity_ordered) || 0)), 0);
  };

  const calculatePOTotal = () => {
    const sub = calculatePOSubtotal();
    const shipping = Number(poForm.shipping_cost || 0);
    const customs = Number(poForm.customs_duty || 0);
    const other = Number(poForm.other_costs || 0);
    const tax = Number(poForm.tax_amount || 0);
    return sub + shipping + customs + other + tax;
  };

  const savePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForm.supplier_id) {
      toast.error("Please select a supplier");
      return;
    }
    if (poForm.items.some((it) => !it.product_name.trim() || it.quantity_ordered <= 0)) {
      toast.error("All items require a name and quantity greater than zero");
      return;
    }

    setSubmitting(true);
    const payload: PurchaseOrderInput = {
      supplier_id: poForm.supplier_id,
      order_date: poForm.order_date || undefined,
      expected_delivery_date: poForm.expected_delivery_date || undefined,
      tracking_number: poForm.tracking_number.trim(),
      shipping_carrier: poForm.shipping_carrier.trim(),
      shipping_cost: kobo(poForm.shipping_cost),
      customs_duty: kobo(poForm.customs_duty),
      other_costs: kobo(poForm.other_costs),
      tax_amount: kobo(poForm.tax_amount),
      notes: poForm.notes.trim(),
      items: poForm.items.map((it) => ({
        product_id: it.product_id || null,
        product_name: it.product_name.trim(),
        sku: it.sku.trim(),
        quantity_ordered: Number(it.quantity_ordered),
        unit_cost: kobo(it.unit_cost),
      })),
    };

    try {
      if (editingPO) {
        await adminFetch(`/purchase-orders/${editingPO.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success(`Purchase Order ${editingPO.po_number} updated`);
      } else {
        const created = await adminFetch<PurchaseOrder>("/purchase-orders", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success(`Purchase Order ${created.po_number} created`);
      }
      setPOModalOpen(false);
      loadPOs();
      loadStats();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Status changes (e.g. mark ordered or cancelled)
  const changePOStatus = async (id: string, newStatus: string) => {
    try {
      await adminFetch(`/purchase-orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(`PO status updated to ${newStatus}`);
      loadPOs();
      loadStats();
      if (viewingPO && viewingPO.id === id) {
        const updated = await adminFetch<PurchaseOrder>(`/purchase-orders/${id}`);
        setViewingPO(updated);
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const deletePO = async (po: PurchaseOrder) => {
    if (!confirm(`Delete Purchase Order ${po.po_number}?`)) return;
    try {
      await adminFetch(`/purchase-orders/${po.id}`, { method: "DELETE" });
      toast.success(`Purchase Order ${po.po_number} deleted`);
      loadPOs();
      loadStats();
      if (viewingPO?.id === po.id) setViewingPO(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Receive goods flow
  const openReceiveModal = async (po: PurchaseOrder) => {
    let target = po;
    if (!target.items || target.items.length === 0) {
      try {
        target = await adminFetch<PurchaseOrder>(`/purchase-orders/${po.id}`);
      } catch (err) {
        toast.error((err as Error).message);
        return;
      }
    }
    setReceivePO(target);
    const initialQtys: Record<string, number> = {};
    for (const it of (target.items || [])) {
      const remaining = it.quantity_ordered - it.quantity_received;
      initialQtys[it.id] = remaining > 0 ? remaining : 0;
    }
    setReceiveQtys(initialQtys);
    setUpdateCostPrice(true);
    setReceiveNotes("");
    setReceiveModalOpen(true);
  };

  const submitReceiveGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivePO) return;

    const itemsToReceive = Object.entries(receiveQtys)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([id, qty]) => ({ item_id: id, quantity_received: Number(qty) }));

    if (itemsToReceive.length === 0) {
      toast.error("Specify quantity to receive for at least one item");
      return;
    }

    setSubmitting(true);
    const payload: ReceiveGoodsInput = {
      items: itemsToReceive,
      update_cost_price: updateCostPrice,
      notes: receiveNotes.trim(),
    };

    try {
      const updated = await adminFetch<PurchaseOrder>(`/purchase-orders/${receivePO.id}/receive`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success(`Stock received and updated for ${updated.po_number}`);
      setReceiveModalOpen(false);
      loadPOs();
      loadStats();
      if (viewingPO?.id === updated.id) setViewingPO(updated);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Record payment flow
  const openPaymentModal = (po: PurchaseOrder) => {
    setPaymentPO(po);
    const balance = po.total_cost - po.amount_paid;
    setPaymentAmount(balance > 0 ? String(balance / 100) : "0");
    setPaymentMethod("bank_transfer");
    setPaymentRef("");
    setPaymentNotes("");
    setPaymentModalOpen(true);
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentPO) return;
    const amountVal = Number(paymentAmount || 0);
    if (amountVal <= 0) {
      toast.error("Payment amount must be greater than zero");
      return;
    }

    setSubmitting(true);
    const payload: ProcurementPaymentInput = {
      amount: kobo(amountVal),
      payment_method: paymentMethod,
      reference: paymentRef.trim(),
      notes: paymentNotes.trim(),
    };

    try {
      const updated = await adminFetch<PurchaseOrder>(`/purchase-orders/${paymentPO.id}/payments`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success(`Payment recorded for ${updated.po_number}`);
      setPaymentModalOpen(false);
      loadPOs();
      loadStats();
      if (viewingPO?.id === updated.id) setViewingPO(updated);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Supplier Form state
  const [supplierForm, setSupplierForm] = useState<SupplierInput>({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "Nigeria",
    payment_terms: "immediate",
    bank_details: "",
    lead_time_days: 7,
    notes: "",
    is_active: true,
  });

  const openNewSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm({
      name: "",
      contact_person: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      country: "Nigeria",
      payment_terms: "immediate",
      bank_details: "",
      lead_time_days: 7,
      notes: "",
      is_active: true,
    });
    setSupplierModalOpen(true);
  };

  const openEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setSupplierForm({
      name: s.name,
      contact_person: s.contact_person,
      email: s.email,
      phone: s.phone,
      address: s.address,
      city: s.city,
      country: s.country,
      payment_terms: s.payment_terms,
      bank_details: s.bank_details,
      lead_time_days: s.lead_time_days,
      notes: s.notes,
      is_active: s.is_active,
    });
    setSupplierModalOpen(true);
  };

  const saveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    setSubmitting(true);
    try {
      if (editingSupplier) {
        await adminFetch(`/suppliers/${editingSupplier.id}`, {
          method: "PUT",
          body: JSON.stringify(supplierForm),
        });
        toast.success(`Supplier ${supplierForm.name} updated`);
      } else {
        await adminFetch("/suppliers", {
          method: "POST",
          body: JSON.stringify(supplierForm),
        });
        toast.success(`Supplier ${supplierForm.name} created`);
      }
      setSupplierModalOpen(false);
      loadSuppliers();
      loadStats();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Procurement & Suppliers"
        subtitle="Manage vendor relationships, purchase orders, landed costs, and inventory replenishment."
        actions={
          <div className="flex gap-2">
            <button onClick={openNewSupplier} className="btn-outline btn-sm">
              <Building2 className="h-4 w-4" /> New Supplier
            </button>
            <button onClick={() => openNewPO()} className="btn-primary btn-sm">
              <Plus className="h-4 w-4" /> Create Purchase Order
            </button>
          </div>
        }
      />

      {/* Metrics Banner */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-xs text-stone">Total PO Spend</p>
          <p className="mt-1 text-xl font-semibold text-ink">{formatNaira(stats?.total_spend ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-xs text-stone">Paid This Month</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">{formatNaira(stats?.spend_this_month ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-xs text-stone">Pending Deliveries</p>
          <p className="mt-1 text-xl font-semibold text-amber-800">{stats?.pending_pos_count ?? 0}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-xs text-stone">Unpaid to Suppliers</p>
          <p className="mt-1 text-xl font-semibold text-rose-700">{formatNaira(stats?.unpaid_supplier_amount ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-xs text-stone">Inventory Cost Val.</p>
          <p className="mt-1 text-xl font-semibold text-ink">{formatNaira(stats?.total_inventory_cost ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-xs text-stone">Active Suppliers</p>
          <p className="mt-1 text-xl font-semibold text-ink">{stats?.active_suppliers_count ?? 0}</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="mb-4 flex border-b border-line">
        <button
          onClick={() => setActiveTab("pos")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-5 py-2.5 text-sm font-medium transition",
            activeTab === "pos" ? "border-ink text-ink font-semibold" : "border-transparent text-stone hover:text-ink"
          )}
        >
          <FileText className="h-4 w-4" /> Purchase Orders
        </button>
        <button
          onClick={() => setActiveTab("suppliers")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-5 py-2.5 text-sm font-medium transition",
            activeTab === "suppliers" ? "border-ink text-ink font-semibold" : "border-transparent text-stone hover:text-ink"
          )}
        >
          <Building2 className="h-4 w-4" /> Suppliers ({allSuppliers.length})
        </button>
      </div>

      {/* TAB 1: PURCHASE ORDERS */}
      {activeTab === "pos" && (
        <>
          <div className="no-scrollbar mb-4 flex gap-1 overflow-x-auto">
            {PO_STATUS_TABS.map((t) => (
              <button
                key={t.id || "all"}
                onClick={() => { setPOStatus(t.id); setPOPage(1); }}
                className={cn(
                  "whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs",
                  poStatus === t.id ? "bg-ink text-white" : "bg-white text-stone ring-1 ring-line hover:text-ink"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <Panel>
            <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
              <div className="flex min-w-64 flex-1 items-center gap-2 rounded-md border border-line px-3">
                <Search className="h-4 w-4 text-mist" />
                <input
                  value={poQuery}
                  onChange={(e) => { setPOQuery(e.target.value); setPOPage(1); }}
                  placeholder="Search PO number, supplier, tracking or notes"
                  className="w-full py-2 text-sm outline-none"
                />
              </div>
              <select
                value={poPaymentStatus}
                onChange={(e) => { setPOPaymentStatus(e.target.value); setPOPage(1); }}
                className="input py-1.5 text-xs max-w-44"
              >
                <option value="">All Payments</option>
                <option value="unpaid">Unpaid</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            {!poData ? (
              <Spinner />
            ) : poData.items.length === 0 ? (
              <Empty>
                No purchase orders found.{" "}
                <button onClick={() => openNewPO()} className="text-bronze hover:underline font-medium">
                  Create a purchase order
                </button>
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-sm">
                  <thead className="bg-cream/60 text-left text-xs text-stone">
                    <tr>
                      <th className="px-5 py-3 font-medium">PO Number</th>
                      <th className="px-3 py-3 font-medium">Supplier</th>
                      <th className="px-3 py-3 font-medium">Order Date</th>
                      <th className="px-3 py-3 font-medium">Total Cost</th>
                      <th className="px-3 py-3 font-medium">Paid / Balance</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Payment</th>
                      <th className="px-5 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {poData.items.map((po) => {
                      const balance = po.total_cost - po.amount_paid;
                      return (
                        <tr key={po.id} className="hover:bg-sand/30 transition">
                          <td className="px-5 py-3.5 font-mono font-medium text-ink">
                            <button
                              onClick={() => openViewPO(po)}
                              className="text-bronze hover:underline hover:text-ink font-semibold"
                            >
                              {po.po_number}
                            </button>
                          </td>
                          <td className="px-3 py-3.5 font-medium">{po.supplier_name}</td>
                          <td className="px-3 py-3.5 text-stone text-xs">
                            {po.order_date ? po.order_date : "Draft"}
                            {po.expected_delivery_date && (
                              <div className="text-[11px] text-mist">Due: {po.expected_delivery_date}</div>
                            )}
                          </td>
                          <td className="px-3 py-3.5 font-medium">{formatNaira(po.total_cost)}</td>
                          <td className="px-3 py-3.5 text-xs">
                            <span className="text-emerald-700 font-medium">{formatNaira(po.amount_paid)}</span>
                            {balance > 0 && (
                              <span className="text-rose-600 block text-[11px]">Due: {formatNaira(balance)}</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            <Badge value={po.status} />
                          </td>
                          <td className="px-3 py-3.5">
                            <Badge value={po.payment_status} />
                          </td>
                          <td className="px-5 py-3.5 text-right space-x-1">
                            <button
                              onClick={() => openViewPO(po)}
                              className="btn-ghost btn-sm p-1.5"
                              title="View PO Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            {(po.status === "ordered" || po.status === "partially_received") && (
                              <button
                                onClick={() => openReceiveModal(po)}
                                className="btn-outline btn-sm py-1 px-2 text-xs bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                                title="Receive Goods into Inventory"
                              >
                                <PackageCheck className="h-3.5 w-3.5 mr-1 inline" /> Receive
                              </button>
                            )}

                            {po.payment_status !== "paid" && po.status !== "cancelled" && (
                              <button
                                onClick={() => openPaymentModal(po)}
                                className="btn-outline btn-sm py-1 px-2 text-xs text-indigo-800 border-indigo-200 hover:bg-indigo-50"
                                title="Record Payment"
                              >
                                <span className="font-bold text-xs mr-0.5 inline-block">₦</span> Pay
                              </button>
                            )}

                            {po.status === "draft" && (
                              <button
                                onClick={() => openEditPO(po)}
                                className="btn-ghost btn-sm p-1.5"
                                title="Edit Draft"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}

                            {po.amount_paid === 0 && po.status !== "received" && po.status !== "partially_received" && (
                              <button
                                onClick={() => deletePO(po)}
                                className="btn-ghost btn-sm p-1.5 text-stone hover:text-rose-600 hover:bg-rose-50"
                                title="Delete Purchase Order"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {/* TAB 2: SUPPLIERS */}
      {activeTab === "suppliers" && (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
            <div className="flex min-w-64 flex-1 items-center gap-2 rounded-md border border-line px-3">
              <Search className="h-4 w-4 text-mist" />
              <input
                value={supplierQuery}
                onChange={(e) => setSupplierQuery(e.target.value)}
                placeholder="Search supplier name, contact, phone, email"
                className="w-full py-2 text-sm outline-none"
              />
            </div>
            <button onClick={openNewSupplier} className="btn-primary btn-sm">
              <Plus className="h-4 w-4" /> Add Supplier
            </button>
          </div>

          {!suppliersData ? (
            <Spinner />
          ) : suppliersData.items.length === 0 ? (
            <Empty>
              No suppliers found.{" "}
              <button onClick={openNewSupplier} className="text-bronze hover:underline font-medium">
                Add your first supplier
              </button>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-cream/60 text-left text-xs text-stone">
                  <tr>
                    <th className="px-5 py-3 font-medium">Supplier</th>
                    <th className="px-3 py-3 font-medium">Contact Person</th>
                    <th className="px-3 py-3 font-medium">Contact Details</th>
                    <th className="px-3 py-3 font-medium">Terms & Lead Time</th>
                    <th className="px-3 py-3 font-medium">Orders / Spend</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {suppliersData.items.map((sup) => (
                    <tr key={sup.id} className="hover:bg-sand/30 transition">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-ink">{sup.name}</div>
                        <div className="text-xs text-mist">{sup.city}{sup.city && sup.country ? ", " : ""}{sup.country}</div>
                      </td>
                      <td className="px-3 py-3.5 text-stone">{sup.contact_person || "—"}</td>
                      <td className="px-3 py-3.5 text-xs">
                        {sup.phone && <div className="text-ink">{sup.phone}</div>}
                        {sup.email && <div className="text-mist">{sup.email}</div>}
                      </td>
                      <td className="px-3 py-3.5 text-xs">
                        <div className="capitalize">{sup.payment_terms.replace("_", " ")}</div>
                        <div className="text-mist">{sup.lead_time_days} days lead time</div>
                      </td>
                      <td className="px-3 py-3.5 text-xs">
                        <span className="font-medium">{sup.po_count ?? 0} POs</span>
                        <div className="text-stone">{formatNaira(sup.total_spent ?? 0)}</div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                          sup.is_active ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-stone-100 text-stone-600 ring-stone-200"
                        )}>
                          {sup.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1">
                        <button
                          onClick={() => openNewPO(sup.id)}
                          className="btn-outline btn-sm py-1 px-2 text-xs"
                          title="Create PO for this supplier"
                        >
                          <Plus className="h-3 w-3 mr-1 inline" /> PO
                        </button>
                        <button
                          onClick={() => openEditSupplier(sup)}
                          className="btn-ghost btn-sm p-1.5"
                          title="Edit Supplier"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* MODAL: CREATE / EDIT PURCHASE ORDER */}
      <Modal
        open={poModalOpen}
        onClose={() => setPOModalOpen(false)}
        title={editingPO ? `Edit Purchase Order ${editingPO.po_number}` : "Create Purchase Order"}
        wide
      >
        <form onSubmit={savePO} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Supplier *</label>
              <select
                required
                value={poForm.supplier_id}
                onChange={(e) => setPOForm({ ...poForm, supplier_id: e.target.value })}
                className="input"
              >
                <option value="">Select Supplier</option>
                {allSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.city})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Order Date</label>
              <input
                type="date"
                value={poForm.order_date}
                onChange={(e) => setPOForm({ ...poForm, order_date: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Expected Delivery Date</label>
              <input
                type="date"
                value={poForm.expected_delivery_date}
                onChange={(e) => setPOForm({ ...poForm, expected_delivery_date: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Shipping Carrier</label>
              <input
                type="text"
                placeholder="e.g. DHL, GIG Logistics, Red Star"
                value={poForm.shipping_carrier}
                onChange={(e) => setPOForm({ ...poForm, shipping_carrier: e.target.value })}
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Tracking Number</label>
              <input
                type="text"
                placeholder="Waybill / Tracking #"
                value={poForm.tracking_number}
                onChange={(e) => setPOForm({ ...poForm, tracking_number: e.target.value })}
                className="input"
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Order Items</h3>
              <button
                type="button"
                onClick={addPOItem}
                className="btn-outline btn-sm py-1 px-2 text-xs"
              >
                <Plus className="h-3 w-3 mr-1 inline" /> Add Item
              </button>
            </div>

            <div className="space-y-2 rounded-lg border border-line p-3 bg-sand/20">
              {poForm.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
                  <div className="col-span-4">
                    <select
                      value={item.product_id}
                      onChange={(e) => handleProductSelect(idx, e.target.value)}
                      className="input py-1 text-xs"
                    >
                      <option value="">— Link Catalogue Product (Optional) —</option>
                      {productsList.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input
                      required
                      placeholder="Product / Item Name *"
                      value={item.product_name}
                      onChange={(e) => handlePOItemChange(idx, "product_name", e.target.value)}
                      className="input py-1 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="Qty"
                      value={item.quantity_ordered}
                      onChange={(e) => handlePOItemChange(idx, "quantity_ordered", Math.max(1, Number(e.target.value)))}
                      className="input py-1 text-xs text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="Unit Cost (₦)"
                      value={item.unit_cost}
                      onChange={(e) => handlePOItemChange(idx, "unit_cost", e.target.value)}
                      className="input py-1 text-xs"
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => removePOItem(idx)}
                      disabled={poForm.items.length <= 1}
                      className="text-stone hover:text-red-700 disabled:opacity-30 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-right text-xs text-stone">
              Items Subtotal: <strong>{formatNaira(kobo(calculatePOSubtotal()))}</strong>
            </div>
          </div>

          {/* Landed Costs Breakdown */}
          <div className="rounded-lg border border-line p-3 bg-cream/40">
            <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">Landed Costs Breakdown (₦)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[11px] text-stone">Shipping Cost</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={poForm.shipping_cost}
                  onChange={(e) => setPOForm({ ...poForm, shipping_cost: e.target.value })}
                  className="input py-1 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] text-stone">Customs Duty</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={poForm.customs_duty}
                  onChange={(e) => setPOForm({ ...poForm, customs_duty: e.target.value })}
                  className="input py-1 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] text-stone">Other Logistics</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={poForm.other_costs}
                  onChange={(e) => setPOForm({ ...poForm, other_costs: e.target.value })}
                  className="input py-1 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] text-stone">Taxes / VAT</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={poForm.tax_amount}
                  onChange={(e) => setPOForm({ ...poForm, tax_amount: e.target.value })}
                  className="input py-1 text-xs"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-between items-center text-sm font-semibold border-t border-line pt-2">
              <span>Total Landed Purchase Cost:</span>
              <span className="text-base text-emerald-800">{formatNaira(kobo(calculatePOTotal()))}</span>
            </div>
          </div>

          <div>
            <label className="label">Notes / Instructions</label>
            <textarea
              rows={2}
              placeholder="Delivery notes, terms or supplier references..."
              value={poForm.notes}
              onChange={(e) => setPOForm({ ...poForm, notes: e.target.value })}
              className="input"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPOModalOpen(false)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingPO ? "Update Purchase Order" : "Generate Purchase Order"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: VIEW PURCHASE ORDER DETAILS */}
      <Modal
        open={!!viewingPO}
        onClose={() => setViewingPO(null)}
        title={viewingPO ? `Purchase Order ${viewingPO.po_number}` : ""}
        wide
      >
        {viewingPO && (
          <div className="space-y-6 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-sand/30 p-4 rounded-lg">
              <div>
                <span className="text-xs text-mist block">Supplier</span>
                <strong className="text-ink">{viewingPO.supplier_name}</strong>
              </div>
              <div>
                <span className="text-xs text-mist block">Order Date</span>
                <span>{viewingPO.order_date || "Draft"}</span>
              </div>
              <div>
                <span className="text-xs text-mist block">Expected Delivery</span>
                <span>{viewingPO.expected_delivery_date || "—"}</span>
              </div>
              <div>
                <span className="text-xs text-mist block">Status / Payment</span>
                <div className="flex gap-1 mt-0.5">
                  <Badge value={viewingPO.status} />
                  <Badge value={viewingPO.payment_status} />
                </div>
              </div>
              {viewingPO.tracking_number && (
                <div className="col-span-2">
                  <span className="text-xs text-mist block">Carrier & Tracking</span>
                  <span>{viewingPO.shipping_carrier ? `${viewingPO.shipping_carrier} — ` : ""}{viewingPO.tracking_number}</span>
                </div>
              )}
              {viewingPO.created_by_name && (
                <div className="col-span-2">
                  <span className="text-xs text-mist block">Created By</span>
                  <span>{viewingPO.created_by_name}</span>
                </div>
              )}
            </div>

            {/* Line items table */}
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-wider text-stone mb-2">Order Line Items</h4>
              <table className="w-full text-xs divide-y divide-line">
                <thead className="bg-cream/50 text-left text-stone">
                  <tr>
                    <th className="py-2 px-3">Item</th>
                    <th className="py-2 px-3">SKU</th>
                    <th className="py-2 px-3 text-center">Ordered</th>
                    <th className="py-2 px-3 text-center">Received</th>
                    <th className="py-2 px-3 text-right">Unit Cost</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(viewingPO.items || []).map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 px-3 font-medium">{it.product_name}</td>
                      <td className="py-2 px-3 text-stone">{it.sku || "—"}</td>
                      <td className="py-2 px-3 text-center">{it.quantity_ordered}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={it.quantity_received >= it.quantity_ordered ? "text-emerald-700 font-semibold" : "text-amber-800"}>
                          {it.quantity_received}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">{formatNaira(it.unit_cost)}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatNaira(it.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-sand/20 rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-stone">Subtotal:</span>
                <span>{formatNaira(viewingPO.subtotal)}</span>
              </div>
              {viewingPO.shipping_cost > 0 && (
                <div className="flex justify-between">
                  <span className="text-stone">Shipping:</span>
                  <span>{formatNaira(viewingPO.shipping_cost)}</span>
                </div>
              )}
              {viewingPO.customs_duty > 0 && (
                <div className="flex justify-between">
                  <span className="text-stone">Customs Duty:</span>
                  <span>{formatNaira(viewingPO.customs_duty)}</span>
                </div>
              )}
              {viewingPO.other_costs > 0 && (
                <div className="flex justify-between">
                  <span className="text-stone">Other Costs:</span>
                  <span>{formatNaira(viewingPO.other_costs)}</span>
                </div>
              )}
              {viewingPO.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-stone">Tax:</span>
                  <span>{formatNaira(viewingPO.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm border-t border-line pt-2 mt-1">
                <span>Total Cost:</span>
                <span className="text-emerald-800">{formatNaira(viewingPO.total_cost)}</span>
              </div>
              <div className="flex justify-between font-medium pt-1 text-stone">
                <span>Amount Paid:</span>
                <span className="text-emerald-700">{formatNaira(viewingPO.amount_paid)}</span>
              </div>
              {viewingPO.total_cost - viewingPO.amount_paid > 0 && (
                <div className="flex justify-between font-medium text-rose-700">
                  <span>Outstanding Balance:</span>
                  <span>{formatNaira(viewingPO.total_cost - viewingPO.amount_paid)}</span>
                </div>
              )}
            </div>

            {/* Payments History */}
            {viewingPO.payments && viewingPO.payments.length > 0 && (
              <div>
                <h4 className="font-semibold text-xs uppercase tracking-wider text-stone mb-2">Supplier Payments Log</h4>
                <div className="space-y-1 text-xs">
                  {(viewingPO.payments || []).map((p) => (
                    <div key={p.id} className="flex justify-between items-center bg-white border border-line rounded p-2">
                      <div>
                        <span className="font-medium">{formatDate(p.paid_at, true)}</span> —{" "}
                        <span className="capitalize text-stone">{p.payment_method.replace("_", " ")}</span>
                        {p.reference && <span className="text-mist"> ({p.reference})</span>}
                      </div>
                      <span className="font-bold text-emerald-800">{formatNaira(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewingPO.notes && (
              <div className="text-xs text-stone">
                <strong>Notes:</strong> {viewingPO.notes}
              </div>
            )}

            {/* Quick Actions in View */}
            <div className="flex flex-wrap gap-2 justify-end border-t border-line pt-3">
              {viewingPO.status === "draft" && (
                <button
                  onClick={() => changePOStatus(viewingPO.id, "ordered")}
                  className="btn-primary btn-sm"
                >
                  Mark as Ordered
                </button>
              )}
              {(viewingPO.status === "ordered" || viewingPO.status === "partially_received") && (
                <button
                  onClick={() => openReceiveModal(viewingPO)}
                  className="btn-outline btn-sm bg-emerald-50 text-emerald-800 border-emerald-200"
                >
                  <PackageCheck className="h-4 w-4 mr-1 inline" /> Receive Goods
                </button>
              )}
              {viewingPO.payment_status !== "paid" && viewingPO.status !== "cancelled" && (
                <button
                  onClick={() => openPaymentModal(viewingPO)}
                  className="btn-outline btn-sm text-indigo-800 border-indigo-200"
                >
                  <span className="font-bold mr-1 inline-block text-sm">₦</span> Record Payment
                </button>
              )}
              {viewingPO.status !== "cancelled" && viewingPO.status !== "received" && viewingPO.status !== "partially_received" && (
                <button
                  onClick={() => changePOStatus(viewingPO.id, "cancelled")}
                  className="btn-outline btn-sm text-stone hover:text-ink"
                  title="Void or Cancel this Purchase Order"
                >
                  Cancel PO
                </button>
              )}
              {viewingPO.amount_paid === 0 && viewingPO.status !== "received" && viewingPO.status !== "partially_received" && (
                <button
                  onClick={() => deletePO(viewingPO)}
                  className="btn border border-red-200 text-red-700 hover:bg-red-50 btn-sm"
                  title="Permanently remove this order"
                >
                  <Trash2 className="h-4 w-4 mr-1 inline" /> Delete PO
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: RECEIVE GOODS */}
      <Modal
        open={receiveModalOpen}
        onClose={() => setReceiveModalOpen(false)}
        title={receivePO ? `Receive Goods — ${receivePO.po_number}` : "Receive Goods"}
      >
        {receivePO && (
          <form onSubmit={submitReceiveGoods} className="space-y-4">
            <p className="text-xs text-stone">
              Verify incoming stock quantities. Stock will immediately be incremented and recorded in inventory movements.
            </p>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {(receivePO.items || []).map((it) => {
                const remaining = it.quantity_ordered - it.quantity_received;
                return (
                  <div key={it.id} className="rounded-lg border border-line p-3 text-xs bg-sand/10">
                    <div className="font-semibold text-ink">{it.product_name}</div>
                    <div className="flex justify-between items-center mt-1 text-stone">
                      <span>Ordered: {it.quantity_ordered} | Received: {it.quantity_received}</span>
                      <span className="text-amber-800 font-medium">Pending: {remaining}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-[11px] font-medium text-stone">Receive Now:</label>
                      <input
                        type="number"
                        min="0"
                        max={remaining}
                        value={receiveQtys[it.id] ?? 0}
                        onChange={(e) => setReceiveQtys({ ...receiveQtys, [it.id]: Number(e.target.value) })}
                        className="input py-1 text-xs text-center w-24"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <label className="flex items-center gap-2 text-xs text-stone cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={updateCostPrice}
                onChange={(e) => setUpdateCostPrice(e.target.checked)}
                className="h-4 w-4 accent-[#a8875e]"
              />
              Update linked catalog products cost price to this PO unit cost
            </label>

            <div>
              <label className="label text-xs">Reception Notes</label>
              <input
                type="text"
                placeholder="e.g. Inspected good condition, batch #124"
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                className="input py-1.5 text-xs"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReceiveModalOpen(false)}
                className="btn-outline btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary btn-sm bg-emerald-700 hover:bg-emerald-800"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Confirm Receipt & Update Stock
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: RECORD PAYMENT */}
      <Modal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title={paymentPO ? `Record Supplier Payment — ${paymentPO.po_number}` : "Record Payment"}
      >
        {paymentPO && (
          <form onSubmit={submitPayment} className="space-y-4 text-sm">
            <div className="rounded-lg bg-sand/30 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-stone">Total PO Cost:</span>
                <strong>{formatNaira(paymentPO.total_cost)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-stone">Amount Paid So Far:</span>
                <span className="text-emerald-700 font-semibold">{formatNaira(paymentPO.amount_paid)}</span>
              </div>
              <div className="flex justify-between text-rose-700 font-semibold border-t border-line pt-1">
                <span>Remaining Balance:</span>
                <span>{formatNaira(paymentPO.total_cost - paymentPO.amount_paid)}</span>
              </div>
            </div>

            <div>
              <label className="label">Payment Amount (₦) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="input"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="wire">Wire / FX</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="label">Reference / Receipt Number</label>
              <input
                type="text"
                placeholder="Bank transaction ref, cheque #, etc."
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label">Notes</label>
              <input
                type="text"
                placeholder="Optional notes..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="input"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="btn-outline btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary btn-sm"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save Payment
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: CREATE / EDIT SUPPLIER */}
      <Modal
        open={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        title={editingSupplier ? `Edit Supplier — ${editingSupplier.name}` : "Add Supplier"}
      >
        <form onSubmit={saveSupplier} className="space-y-4 text-sm">
          <div>
            <label className="label">Supplier / Vendor Name *</label>
            <input
              required
              placeholder="e.g. Turkish Fabrics Ltd"
              value={supplierForm.name}
              onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Contact Person</label>
              <input
                placeholder="Representative name"
                value={supplierForm.contact_person}
                onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                placeholder="e.g. +234..."
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                placeholder="orders@supplier.com"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">City / State</label>
              <input
                placeholder="e.g. Lagos, Abuja, Istanbul"
                value={supplierForm.city}
                onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Payment Terms</label>
              <select
                value={supplierForm.payment_terms}
                onChange={(e) => setSupplierForm({ ...supplierForm, payment_terms: e.target.value })}
                className="input"
              >
                <option value="immediate">Immediate / Advance</option>
                <option value="net_15">Net 15 Days</option>
                <option value="net_30">Net 30 Days</option>
                <option value="net_60">Net 60 Days</option>
                <option value="50_50">50% Advance / 50% on Delivery</option>
              </select>
            </div>
            <div>
              <label className="label">Lead Time (Days)</label>
              <input
                type="number"
                min="0"
                value={supplierForm.lead_time_days}
                onChange={(e) => setSupplierForm({ ...supplierForm, lead_time_days: Number(e.target.value) })}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Bank Details / Account Info</label>
            <input
              placeholder="Bank, Account Number, Account Name..."
              value={supplierForm.bank_details}
              onChange={(e) => setSupplierForm({ ...supplierForm, bank_details: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              rows={2}
              placeholder="Material specialties, factory address, contact notes..."
              value={supplierForm.notes}
              onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
              className="input"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-stone cursor-pointer">
            <input
              type="checkbox"
              checked={supplierForm.is_active}
              onChange={(e) => setSupplierForm({ ...supplierForm, is_active: e.target.checked })}
              className="h-4 w-4 accent-[#a8875e]"
            />
            Supplier is active
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSupplierModalOpen(false)}
              className="btn-outline btn-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary btn-sm"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingSupplier ? "Update Supplier" : "Save Supplier"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
