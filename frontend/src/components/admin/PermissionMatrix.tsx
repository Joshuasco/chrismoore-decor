"use client";

import { useMemo } from "react";
import { Check, CheckSquare, Shield, ShieldAlert, Sparkles, X } from "lucide-react";

export type ResourceGroup = {
  id: string;
  title: string;
  description: string;
  crud: {
    read?: string;
    create?: string;
    update?: string;
    delete?: string;
  };
  special?: {
    key: string;
    label: string;
    desc: string;
    badge?: string;
  }[];
};

export const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    id: "products",
    title: "Products & Catalogue",
    description: "Product inventory records, descriptions, and category taxonomy",
    crud: {
      read: "products:read",
      create: "products:create",
      update: "products:update",
      delete: "products:delete",
    },
    special: [
      {
        key: "products:cost_price:read",
        label: "View Cost Price & Margins",
        desc: "Reveal wholesale cost price, unit profit, and markup margins in catalog & forms",
        badge: "Confidential",
      },
      {
        key: "products:cost_price:update",
        label: "Edit Cost Price",
        desc: "Authorize setting or modifying wholesale cost price values",
        badge: "Confidential",
      },
      {
        key: "products:pricing:update",
        label: "Edit Selling Price",
        desc: "Authorize modifying customer selling prices and compare-at discounts",
      },
    ],
  },
  {
    id: "inventory",
    title: "Inventory",
    description: "Stock levels, stock movements, and warehouse adjustments",
    crud: {
      read: "inventory:read",
      update: "inventory:update",
    },
  },
  {
    id: "procurement",
    title: "Procurement & Suppliers",
    description: "Suppliers, purchase orders, landed costs, and supplier payments",
    crud: {
      read: "procurement:read",
      create: "procurement:create",
      update: "procurement:update",
      delete: "procurement:delete",
    },
    special: [
      {
        key: "procurement:receive",
        label: "Receive Incoming Stock",
        desc: "Inspect shipments and directly increment inventory quantities",
      },
      {
        key: "procurement:pay",
        label: "Record Payments",
        desc: "Log cash/bank payments to suppliers",
      },
    ],
  },
  {
    id: "orders",
    title: "Orders & Fulfilment",
    description: "Customer orders, status changes, delivery tracking, and payment verification",
    crud: {
      read: "orders:read",
      create: "orders:create",
      update: "orders:update",
      delete: "orders:delete",
    },
  },
  {
    id: "invoices",
    title: "Invoices",
    description: "Custom customer invoices, pricing breakdown, and payment links",
    crud: {
      read: "invoices:read",
      create: "invoices:create",
      update: "invoices:update",
      delete: "invoices:delete",
    },
  },
  {
    id: "dashboard",
    title: "Overview Analytics",
    description: "High-level sales revenue metrics and performance charts",
    crud: {
      read: "dashboard:read",
    },
  },
  {
    id: "blog",
    title: "Blog & Content",
    description: "Publishing and managing design articles and news",
    crud: {
      read: "blog:read",
      create: "blog:create",
      update: "blog:update",
      delete: "blog:delete",
    },
  },
  {
    id: "reviews",
    title: "Customer Reviews",
    description: "Moderating, featuring, or deleting customer product reviews",
    crud: {
      read: "reviews:read",
      update: "reviews:update",
      delete: "reviews:delete",
    },
  },
  {
    id: "subscribers",
    title: "Subscribers",
    description: "Newsletter subscriber directory and unsubscribes",
    crud: {
      read: "subscribers:read",
      delete: "subscribers:delete",
    },
  },
  {
    id: "settings",
    title: "Store Settings",
    description: "Company contact, shipping rates, and store policies",
    crud: {
      read: "settings:read",
      update: "settings:update",
    },
  },
];

type Props = {
  selected: string[];
  onChange: (keys: string[]) => void;
  inherited?: string[]; // group permissions inherited by the user
  disabled?: boolean;
};

export default function PermissionMatrix({ selected, onChange, inherited = [], disabled }: Props) {
  const isInherited = (k: string) => inherited.includes(k) || inherited.includes(k.split(":")[0]) || inherited.includes(`${k.split(":")[0]}:*`);
  const isChecked = (k: string) => selected.includes(k) || selected.includes(k.split(":")[0]) || isInherited(k);

  const toggle = (k: string) => {
    if (disabled) return;
    if (selected.includes(k)) {
      onChange(selected.filter((x) => x !== k));
    } else {
      onChange([...selected, k]);
    }
  };

  const setGroupPreset = (group: ResourceGroup, preset: "all" | "read" | "none") => {
    if (disabled) return;
    const allKeys: string[] = [];
    if (group.crud.read) allKeys.push(group.crud.read);
    if (group.crud.create) allKeys.push(group.crud.create);
    if (group.crud.update) allKeys.push(group.crud.update);
    if (group.crud.delete) allKeys.push(group.crud.delete);
    if (group.special) {
      for (const sp of group.special) allKeys.push(sp.key);
    }
    // Also include legacy coarse key if present
    allKeys.push(group.id);

    let next = selected.filter((k) => !allKeys.includes(k));

    if (preset === "all") {
      const keysToAdd = [
        group.crud.read,
        group.crud.create,
        group.crud.update,
        group.crud.delete,
        ...(group.special ? group.special.map((s) => s.key) : []),
      ].filter(Boolean) as string[];
      next = Array.from(new Set([...next, ...keysToAdd]));
    } else if (preset === "read") {
      if (group.crud.read) next.push(group.crud.read);
    }

    onChange(next);
  };

  const setGlobalPreset = (preset: "all" | "read" | "clear") => {
    if (disabled) return;
    if (preset === "clear") {
      onChange([]);
      return;
    }
    const target: string[] = [];
    for (const g of RESOURCE_GROUPS) {
      if (g.crud.read) target.push(g.crud.read);
      if (preset === "all") {
        if (g.crud.create) target.push(g.crud.create);
        if (g.crud.update) target.push(g.crud.update);
        if (g.crud.delete) target.push(g.crud.delete);
        if (g.special) {
          for (const sp of g.special) target.push(sp.key);
        }
      }
    }
    onChange(Array.from(new Set(target)));
  };

  return (
    <div className="space-y-4">
      {/* Global Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sand/30 p-2.5 text-xs">
        <span className="font-medium text-stone flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-bronze" /> Quick Configuration:
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setGlobalPreset("all")}
            disabled={disabled}
            className="rounded px-2.5 py-1 font-medium bg-white border border-line hover:bg-cream/60 transition"
          >
            Grant Full Access
          </button>
          <button
            type="button"
            onClick={() => setGlobalPreset("read")}
            disabled={disabled}
            className="rounded px-2.5 py-1 font-medium bg-white border border-line hover:bg-cream/60 transition"
          >
            Read-Only Everything
          </button>
          <button
            type="button"
            onClick={() => setGlobalPreset("clear")}
            disabled={disabled}
            className="rounded px-2.5 py-1 font-medium text-stone hover:text-rose-700 transition"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-cream/50 text-stone border-b border-line">
            <tr>
              <th className="py-2.5 px-4 font-semibold w-1/3">Service / Resource</th>
              <th className="py-2.5 px-2 font-semibold text-center w-14">Read</th>
              <th className="py-2.5 px-2 font-semibold text-center w-14">Create</th>
              <th className="py-2.5 px-2 font-semibold text-center w-14">Update</th>
              <th className="py-2.5 px-2 font-semibold text-center w-14">Delete</th>
              <th className="py-2.5 px-3 font-semibold">Special & Sensitive Controls</th>
              <th className="py-2.5 px-3 text-right font-semibold">Presets</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {RESOURCE_GROUPS.map((g) => {
              const readKey = g.crud.read;
              const createKey = g.crud.create;
              const updateKey = g.crud.update;
              const deleteKey = g.crud.delete;

              return (
                <tr key={g.id} className="hover:bg-sand/10 transition">
                  {/* Service info */}
                  <td className="py-3 px-4">
                    <p className="font-semibold text-ink text-sm">{g.title}</p>
                    <p className="text-[11px] text-mist">{g.description}</p>
                  </td>

                  {/* Read */}
                  <td className="py-3 px-2 text-center">
                    {readKey ? (
                      <label className="inline-flex flex-col items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#a8875e] cursor-pointer"
                          disabled={disabled || isInherited(readKey)}
                          checked={isChecked(readKey)}
                          onChange={() => toggle(readKey)}
                        />
                        {isInherited(readKey) && (
                          <span className="text-[9px] text-stone mt-0.5">group</span>
                        )}
                      </label>
                    ) : (
                      <span className="text-mist">—</span>
                    )}
                  </td>

                  {/* Create */}
                  <td className="py-3 px-2 text-center">
                    {createKey ? (
                      <label className="inline-flex flex-col items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#a8875e] cursor-pointer"
                          disabled={disabled || isInherited(createKey)}
                          checked={isChecked(createKey)}
                          onChange={() => toggle(createKey)}
                        />
                        {isInherited(createKey) && (
                          <span className="text-[9px] text-stone mt-0.5">group</span>
                        )}
                      </label>
                    ) : (
                      <span className="text-mist">—</span>
                    )}
                  </td>

                  {/* Update */}
                  <td className="py-3 px-2 text-center">
                    {updateKey ? (
                      <label className="inline-flex flex-col items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#a8875e] cursor-pointer"
                          disabled={disabled || isInherited(updateKey)}
                          checked={isChecked(updateKey)}
                          onChange={() => toggle(updateKey)}
                        />
                        {isInherited(updateKey) && (
                          <span className="text-[9px] text-stone mt-0.5">group</span>
                        )}
                      </label>
                    ) : (
                      <span className="text-mist">—</span>
                    )}
                  </td>

                  {/* Delete */}
                  <td className="py-3 px-2 text-center">
                    {deleteKey ? (
                      <label className="inline-flex flex-col items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#a8875e] cursor-pointer"
                          disabled={disabled || isInherited(deleteKey)}
                          checked={isChecked(deleteKey)}
                          onChange={() => toggle(deleteKey)}
                        />
                        {isInherited(deleteKey) && (
                          <span className="text-[9px] text-stone mt-0.5">group</span>
                        )}
                      </label>
                    ) : (
                      <span className="text-mist">—</span>
                    )}
                  </td>

                  {/* Special / Sensitive */}
                  <td className="py-3 px-3">
                    {g.special && g.special.length > 0 ? (
                      <div className="space-y-1.5">
                        {g.special.map((sp) => {
                          const inh = isInherited(sp.key);
                          const chk = isChecked(sp.key);
                          return (
                            <label
                              key={sp.key}
                              className={`flex items-start gap-2 p-1.5 rounded cursor-pointer transition ${
                                chk ? "bg-sand/30" : "hover:bg-cream/40"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 mt-0.5 accent-[#a8875e] cursor-pointer"
                                disabled={disabled || inh}
                                checked={chk}
                                onChange={() => toggle(sp.key)}
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-ink">{sp.label}</span>
                                  {sp.badge && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-rose-100 text-rose-800">
                                      {sp.badge}
                                    </span>
                                  )}
                                  {inh && <span className="text-[9px] text-stone">(from group)</span>}
                                </div>
                                <p className="text-[10px] text-mist">{sp.desc}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-mist text-[11px]">Standard CRUD only</span>
                    )}
                  </td>

                  {/* Row presets */}
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setGroupPreset(g, "all")}
                        disabled={disabled}
                        className="px-1.5 py-0.5 text-[11px] rounded hover:bg-sand font-medium text-stone hover:text-ink transition"
                      >
                        All
                      </button>
                      <span className="text-line">|</span>
                      <button
                        type="button"
                        onClick={() => setGroupPreset(g, "read")}
                        disabled={disabled}
                        className="px-1.5 py-0.5 text-[11px] rounded hover:bg-sand font-medium text-stone hover:text-ink transition"
                      >
                        Read
                      </button>
                      <span className="text-line">|</span>
                      <button
                        type="button"
                        onClick={() => setGroupPreset(g, "none")}
                        disabled={disabled}
                        className="px-1.5 py-0.5 text-[11px] rounded hover:bg-sand font-medium text-stone hover:text-rose-700 transition"
                      >
                        Off
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
