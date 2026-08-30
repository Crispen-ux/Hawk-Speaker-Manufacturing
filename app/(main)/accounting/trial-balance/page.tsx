import { PageHeader, Card } from "@/components/ui";
import { computeLedger, ACCOUNT_TYPE_LABELS } from "@/lib/ledger";
import type { AccountType, SignedRow } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

const TYPE_ORDER: AccountType[] = ["asset", "liability", "equity", "income", "expense"];

function MoneyCell({ value, money }: { value: number; money: (v: number) => string }) {
  if (value === 0) return <td className="px-4 py-2.5"></td>;
  return <td className="px-4 py-2.5 text-right font-mono">{money(value)}</td>;
}

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  const sp = await searchParams;
  const asOf = sp.asOf || undefined;
  const settings = await getSettings();
  const money = (v: number) => formatMoney(v, settings.currency || "R");
  const ledger = await computeLedger(asOf);

  let totalDebits = 0;
  let totalCredits = 0;
  const totalsByType = new Map<AccountType, { debit: number; credit: number }>();
  for (const r of ledger.rows) {
    if (r.signed === 0) continue;
    const t = totalsByType.get(r.type) ?? { debit: 0, credit: 0 };
    if (r.signed > 0) {
      t.debit += r.signed;
      totalDebits += r.signed;
    } else {
      t.credit += -r.signed;
      totalCredits += -r.signed;
    }
    totalsByType.set(r.type, t);
  }

  const groups: { type: AccountType; label: string; rows: SignedRow[]; debit: number; credit: number }[] =
    TYPE_ORDER.map((type) => ({
      type,
      label: ACCOUNT_TYPE_LABELS[type],
      rows: ledger.rows.filter((r) => r.type === type),
      debit: totalsByType.get(type)?.debit ?? 0,
      credit: totalsByType.get(type)?.credit ?? 0,
    }));

  return (
    <div>
      <PageHeader
        eyebrow="General ledger"
        title="Trial balance"
        action={
          <form method="get" className="flex items-end gap-2">
            <label className="block">
              <span className="mb-1.5 mr-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
                As at
              </span>
              <input type="date" name="asOf" defaultValue={asOf ?? new Date().toISOString().slice(0, 10)} className="rounded-md border border-rule-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest" />
            </label>
            <button className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-paper hover:bg-navy-2">Run</button>
          </form>
        }
      />

      <p className="mb-5 text-xs text-ink-soft">
        Every sub-ledger (invoices, payments, expenses, payroll, purchase orders, assets) is consolidated into
        this chart, so debits always equal credits.
      </p>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 text-left font-medium">Account</th>
                <th className="px-4 py-2.5 text-right font-medium">Debit</th>
                <th className="px-4 py-2.5 text-right font-medium">Credit</th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.type}>
                {g.rows.map((r) => (
                  <tr key={r.code} className="border-b border-rule last:border-b-0">
                    <td className="px-4 py-2 text-ink">
                      <span className="mr-3 inline-block w-12 font-mono text-ink-soft">{r.code}</span>
                      <span className="font-medium">{r.name}</span>
                      {r.isSystem && (
                        <span className="ml-2 rounded bg-paper-dim px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-ink-soft">
                          auto
                        </span>
                      )}
                    </td>
                    <MoneyCell value={r.signed > 0 ? r.signed : 0} money={money} />
                    <MoneyCell value={r.signed < 0 ? -r.signed : 0} money={money} />
                  </tr>
                ))}
                <tr className="border-b border-rule bg-paper-dim/50 text-ink last:border-b-0">
                  <td className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                    {g.label} total
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">{money(g.debit)}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">{money(g.credit)}</td>
                </tr>
              </tbody>
            ))}
            <tfoot>
              <tr className="border-t-2 border-navy bg-navy text-paper">
                <td className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em]">Total</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">{money(totalDebits)}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">{money(totalCredits)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <p className="mt-3 text-xs text-ink-soft">
        {Math.abs(totalDebits - totalCredits) < 0.01
          ? "Balanced."
          : `Off by ${money(Math.abs(totalDebits - totalCredits))} — contact your accountant.`}
      </p>
    </div>
  );
}