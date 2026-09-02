"use client";

import { useState } from "react";
import { formatMoney, toNumber } from "@/lib/money";
import { inputClass } from "@/components/ui";

export type SupplierBillItem = {
  bomItemId?: string;
  description: string;
  quantity: string;
  unitCost: string;
  vatTreatment: string;
};

const VAT_LABELS: Record<string, string> = {
  standard: "Std",
  zero_rated: "0%",
  exempt: "Exempt",
};

export default function SupplierBillItemsEditor({
  initialItems,
  currency = "R",
}: {
  initialItems: SupplierBillItem[];
  currency?: string;
}) {
  const money = (v: string | number | null | undefined) => formatMoney(v, currency || "R");
  const [items, setItems] = useState<SupplierBillItem[]>(
    initialItems.length > 0
      ? initialItems
      : [{ description: "", quantity: "1", unitCost: "0", vatTreatment: "standard" }]
  );

  function updateItem(i: number, patch: Partial<SupplierBillItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function addRow() {
    setItems((prev) => [...prev, { description: "", quantity: "1", unitCost: "0", vatTreatment: "standard" }]);
  }

  function removeRow(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = items.reduce((s, it) => s + toNumber(it.quantity) * toNumber(it.unitCost), 0);

  return (
    <div>
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <div className="rounded-lg border border-rule">
        <div className="grid grid-cols-[1fr_80px_120px_80px_80px_32px] gap-2 border-b border-rule bg-paper-dim px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
          <div>Description</div>
          <div>Qty</div>
          <div>Unit cost</div>
          <div>VAT</div>
          <div className="text-right">Line</div>
          <div />
        </div>
        {items.map((it, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_80px_120px_80px_80px_32px] items-center gap-2 border-b border-rule px-4 py-2 last:border-b-0"
          >
            <input
              value={it.description}
              onChange={(e) => updateItem(i, { description: e.target.value })}
              placeholder="Item description…"
              className={inputClass}
            />
            <input
              value={it.quantity}
              onChange={(e) => updateItem(i, { quantity: e.target.value })}
              inputMode="decimal"
              className={`${inputClass} font-mono`}
            />
            <input
              value={it.unitCost}
              onChange={(e) => updateItem(i, { unitCost: e.target.value })}
              inputMode="decimal"
              className={`${inputClass} font-mono`}
            />
            <select
              value={it.vatTreatment}
              onChange={(e) => updateItem(i, { vatTreatment: e.target.value })}
              className={`${inputClass} font-mono text-[11px]`}
            >
              {Object.entries(VAT_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <div className="text-right font-mono text-sm text-ink">
              {money(toNumber(it.quantity) * toNumber(it.unitCost))}
            </div>
            <button type="button" onClick={() => removeRow(i)} className="text-ink-soft hover:text-rust" aria-label="Remove line">
              ✕
            </button>
          </div>
        ))}
        <div className="px-4 py-2.5">
          <button type="button" onClick={addRow} className="font-mono text-xs uppercase tracking-wide text-forest hover:underline">
            + Add line
          </button>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <div className="w-56">
          <div className="flex items-center justify-between border-t border-rule pt-2.5 text-base font-semibold">
            <span>Total</span>
            <span className="font-mono">{money(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
