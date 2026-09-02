"use client";

import { useState } from "react";
import { formatMoney, toNumber } from "@/lib/money";
import { inputClass } from "@/components/ui";

export type BomItem = {
  catalogItemId: string;
  description: string;
  quantity: string;
  unitCost: string;
  markup: string;
  vatTreatment: string;
};
export type CatalogOption = { id: number; name: string; description?: string | null; unitPrice: string; unit?: string | null };

const VAT_LABELS: Record<string, string> = {
  standard: "Std",
  zero_rated: "0%",
  exempt: "Exempt",
};

export default function BomItemsEditor({
  initialItems,
  catalogItems = [],
  currency = "R",
}: {
  initialItems: BomItem[];
  catalogItems?: CatalogOption[];
  currency?: string;
}) {
  const money = (v: string | number | null | undefined) => formatMoney(v, currency || "R");
  const [items, setItems] = useState<BomItem[]>(
    initialItems.length > 0
      ? initialItems
      : [{ catalogItemId: "", description: "", quantity: "1", unitCost: "0", markup: "0", vatTreatment: "standard" }]
  );
  const [catalogPick, setCatalogPick] = useState("");

  function updateItem(i: number, patch: Partial<BomItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function addRow() {
    setItems((prev) => [
      ...prev,
      { catalogItemId: "", description: "", quantity: "1", unitCost: "0", markup: "0", vatTreatment: "standard" },
    ]);
  }

  function addFromCatalog() {
    const chosen = catalogItems.find((c) => String(c.id) === catalogPick);
    if (!chosen) return;
    const description = chosen.unit ? `${chosen.name} (${chosen.unit})` : chosen.name;
    setItems((prev) => {
      const withCatalog = [
        ...prev.filter((it) => it.description.trim() !== ""),
        { catalogItemId: String(chosen.id), description, quantity: "1", unitCost: chosen.unitPrice, markup: "0", vatTreatment: "standard" },
      ];
      return withCatalog;
    });
    setCatalogPick("");
  }

  function removeRow(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  const totalCost = items.reduce((s, it) => {
    const line = toNumber(it.quantity) * toNumber(it.unitCost);
    const charged = line * (1 + toNumber(it.markup) / 100);
    return s + charged;
  }, 0);

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
        <div className="grid grid-cols-[1fr_70px_110px_90px_80px_80px_32px] gap-2 border-b border-rule bg-paper-dim px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
          <div>Component / spare</div>
          <div>Qty</div>
          <div>Unit cost</div>
          <div>Markup %</div>
          <div>VAT</div>
          <div className="text-right">Line</div>
          <div />
        </div>
        {items.map((it, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_70px_110px_90px_80px_80px_32px] items-center gap-2 border-b border-rule px-4 py-2 last:border-b-0"
          >
            <div>
              <input
                value={it.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                placeholder="Spare / component…"
                className={inputClass}
              />
            </div>
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
            <input
              value={it.markup}
              onChange={(e) => updateItem(i, { markup: e.target.value })}
              inputMode="decimal"
              className={`${inputClass} font-mono`}
            />
            <select
              value={it.vatTreatment}
              onChange={(e) => updateItem(i, { vatTreatment: e.target.value })}
              className={`${inputClass} font-mono text-[11px]`}
              title="VAT treatment"
            >
              {Object.entries(VAT_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <div className="text-right font-mono text-sm text-ink">
              {money(toNumber(it.quantity) * toNumber(it.unitCost) * (1 + toNumber(it.markup) / 100))}
            </div>
            <button type="button" onClick={() => removeRow(i)} className="text-ink-soft hover:text-rust" aria-label="Remove line">
              ✕
            </button>
          </div>
        ))}
        <div className="px-4 py-2.5">
          <button type="button" onClick={addRow} className="font-mono text-xs uppercase tracking-wide text-forest hover:underline">
            + Add component
          </button>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <div className="w-64">
          <div className="flex items-center justify-between border-t border-rule pt-2.5 text-base font-semibold">
            <span>Total cost</span>
            <span className="font-mono">{money(totalCost)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
