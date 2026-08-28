"use client";

import { useState } from "react";
import { formatMoney, toNumber } from "@/lib/money";
import { inputClass } from "@/components/ui";

export type Item = { description: string; quantity: string; unitPrice: string };
export type CatalogOption = { id: number; name: string; description?: string | null; unitPrice: string; unit?: string | null };

export default function LineItemsEditor({
  initialItems,
  initialTaxRate,
  initialDiscount,
  catalogItems = [],
  currency = "R",
}: {
  initialItems: Item[];
  initialTaxRate: string;
  initialDiscount: string;
  catalogItems?: CatalogOption[];
  currency?: string;
}) {
  const money = (v: string | number | null | undefined) => formatMoney(v, currency || "R");
  const [items, setItems] = useState<Item[]>(
    initialItems.length > 0 ? initialItems : [{ description: "", quantity: "1", unitPrice: "0" }]
  );
  const [taxRate, setTaxRate] = useState(initialTaxRate);
  const [discount, setDiscount] = useState(initialDiscount);
  const [catalogPick, setCatalogPick] = useState("");

  function updateItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function addRow() {
    setItems((prev) => [...prev, { description: "", quantity: "1", unitPrice: "0" }]);
  }

  function addFromCatalog() {
    const chosen = catalogItems.find((c) => String(c.id) === catalogPick);
    if (!chosen) return;
    const description = chosen.unit ? `${chosen.name} (${chosen.unit})` : chosen.name;
    setItems((prev) => {
      const withCatalog = [
        ...prev.filter((it) => it.description.trim() !== ""),
        { description, quantity: "1", unitPrice: chosen.unitPrice },
      ];
      return withCatalog;
    });
    setCatalogPick("");
  }

  function removeRow(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  const subtotal = items.reduce((s, it) => s + toNumber(it.quantity) * toNumber(it.unitPrice), 0);
  const afterDiscount = Math.max(subtotal - toNumber(discount), 0);
  const tax = afterDiscount * (toNumber(taxRate) / 100);
  const total = afterDiscount + tax;

  return (
    <div>
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      {catalogItems.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <select
            value={catalogPick}
            onChange={(e) => setCatalogPick(e.target.value)}
            className={`${inputClass} max-w-xs`}
          >
            <option value="">Add from catalogue…</option>
            {catalogItems.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {money(c.unitPrice)}
                {c.unit ? ` / ${c.unit}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addFromCatalog}
            disabled={!catalogPick}
            className="rounded-md border border-rule-strong px-3 py-2 text-sm font-medium text-ink hover:bg-paper-dim disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}

      <div className="rounded-lg border border-rule">
        <div className="grid grid-cols-[1fr_90px_130px_110px_36px] gap-2 border-b border-rule bg-paper-dim px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
          <div>Description</div>
          <div>Qty</div>
          <div>Unit price</div>
          <div className="text-right">Line total</div>
          <div />
        </div>
        {items.map((it, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_90px_130px_110px_36px] items-center gap-2 border-b border-rule px-4 py-2 last:border-b-0"
          >
            <input
              value={it.description}
              onChange={(e) => updateItem(i, { description: e.target.value })}
              placeholder="Design consultation…"
              className={inputClass}
            />
            <input
              value={it.quantity}
              onChange={(e) => updateItem(i, { quantity: e.target.value })}
              inputMode="decimal"
              className={`${inputClass} font-mono`}
            />
            <input
              value={it.unitPrice}
              onChange={(e) => updateItem(i, { unitPrice: e.target.value })}
              inputMode="decimal"
              className={`${inputClass} font-mono`}
            />
            <div className="text-right font-mono text-sm text-ink">
              {money(toNumber(it.quantity) * toNumber(it.unitPrice))}
            </div>
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="text-ink-soft hover:text-rust"
              aria-label="Remove line"
            >
              ✕
            </button>
          </div>
        ))}
        <div className="px-4 py-2.5">
          <button
            type="button"
            onClick={addRow}
            className="font-mono text-xs uppercase tracking-wide text-forest hover:underline"
          >
            + Add line
          </button>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <div className="w-72 space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">Subtotal</span>
            <span className="font-mono">{money(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">Discount</span>
            <input
              name="discount"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              inputMode="decimal"
              className="w-24 rounded-md border border-rule-strong bg-white px-2 py-1 text-right font-mono text-sm outline-none focus:border-forest"
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">Tax rate %</span>
            <input
              name="taxRate"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              inputMode="decimal"
              className="w-24 rounded-md border border-rule-strong bg-white px-2 py-1 text-right font-mono text-sm outline-none focus:border-forest"
            />
          </div>
          <div className="flex items-center justify-between border-t border-rule pt-2.5 text-base font-semibold">
            <span>Total</span>
            <span className="font-mono">{money(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
