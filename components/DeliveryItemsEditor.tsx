"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

export type DeliveryItem = { description: string; quantity: string };

export default function DeliveryItemsEditor({
  initialItems,
}: {
  initialItems: DeliveryItem[];
}) {
  const [items, setItems] = useState<DeliveryItem[]>(
    initialItems.length > 0 ? initialItems : [{ description: "", quantity: "1" }]
  );

  function updateItem(i: number, patch: Partial<DeliveryItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function addRow() {
    setItems((prev) => [...prev, { description: "", quantity: "1" }]);
  }

  function removeRow(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <div className="rounded-lg border border-rule">
        <div className="grid grid-cols-[1fr_110px_36px] gap-2 border-b border-rule bg-paper-dim px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
          <div>Description</div>
          <div>Qty delivered</div>
          <div />
        </div>
        {items.map((it, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_110px_36px] items-center gap-2 border-b border-rule px-4 py-2 last:border-b-0"
          >
            <input
              value={it.description}
              onChange={(e) => updateItem(i, { description: e.target.value })}
              placeholder="Dell PowerEdge R740 server…"
              className={inputClass}
            />
            <input
              value={it.quantity}
              onChange={(e) => updateItem(i, { quantity: e.target.value })}
              inputMode="decimal"
              className={`${inputClass} font-mono`}
            />
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
    </div>
  );
}
