"use client";

import { useState } from "react";
import { formatMoney, toNumber } from "@/lib/money";
import { inputClass } from "@/components/ui";

export type JournalAccount = { id: number; code: string; name: string; type: string };
export type JournalLine = { accountId: string; debit: string; credit: string; memo: string };

const TYPE_LABELS: Record<string, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  income: "Income",
  expense: "Expense",
};

export default function JournalLinesEditor({
  accounts,
  initialLines = [],
  currency = "R",
}: {
  accounts: JournalAccount[];
  initialLines?: JournalLine[];
  currency?: string;
}) {
  const money = (v: string | number) => formatMoney(v, currency || "R");
  const [lines, setLines] = useState<JournalLine[]>(
    initialLines.length > 0 ? initialLines : [{ accountId: "", debit: "", credit: "", memo: "" }]
  );

  function updateLine(i: number, patch: Partial<JournalLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addRow() {
    setLines((prev) => [...prev, { accountId: "", debit: "", credit: "", memo: "" }]);
  }

  function removeRow(i: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  const totalDebit = lines.reduce((s, l) => s + toNumber(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + toNumber(l.credit), 0);
  const difference = totalDebit - totalCredit;
  const balanced = Math.abs(difference) < 0.01 && totalDebit > 0;

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-rule">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule bg-paper-dim font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
              <th className="px-3 py-2 text-left font-medium">Account</th>
              <th className="w-32 px-3 py-2 text-right font-medium">Debit</th>
              <th className="w-32 px-3 py-2 text-right font-medium">Credit</th>
              <th className="px-3 py-2 text-left font-medium">Line memo</th>
              <th className="w-16 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-rule last:border-b-0">
                <td className="px-3 py-2">
                  <select
                    value={l.accountId}
                    onChange={(e) => updateLine(i, { accountId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Select account…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.code} · {a.name} ({TYPE_LABELS[a.type] ?? a.type})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className={`${inputClass} text-right`}
                    value={l.debit}
                    onChange={(e) => updateLine(i, { debit: e.target.value, credit: "" })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className={`${inputClass} text-right`}
                    value={l.credit}
                    onChange={(e) => updateLine(i, { credit: e.target.value, debit: "" })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    placeholder="Optional note"
                    className={inputClass}
                    value={l.memo}
                    onChange={(e) => updateLine(i, { memo: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    disabled={lines.length <= 1}
                    className="text-xs text-ink-soft hover:text-rust disabled:opacity-40"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-rule bg-paper-dim/60 font-mono">
              <td className="px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-ink-soft">Totals</td>
              <td className="px-3 py-2 text-right font-semibold">{money(totalDebit)}</td>
              <td className="px-3 py-2 text-right font-semibold">{money(totalCredit)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {balanced ? (
            <span className="font-medium text-forest">Balanced — {money(totalDebit)}</span>
          ) : totalDebit === 0 && totalCredit === 0 ? (
            <span className="text-ink-soft">Enter at least two lines with amounts.</span>
          ) : (
            <span className="font-medium text-rust">
              Difference {money(Math.abs(difference))} — {difference > 0 ? "more debits" : "more credits"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border border-rule-strong px-3 py-1.5 text-sm font-medium text-ink hover:bg-paper-dim"
        >
          + Add line
        </button>
      </div>

      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
    </div>
  );
}