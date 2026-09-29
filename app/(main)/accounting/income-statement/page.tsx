import { PageHeader, Card } from "@/components/ui";
import { getIncomeStatement } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import DownloadLinks from "@/components/DownloadLinks";

export const dynamic = "force-dynamic";

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = `${today.slice(0, 4)}-01-01`;
  const from = sp.from || defaultFrom;
  const to = sp.to || today;

  const settings = await getSettings();
  const money = (v: number) => formatMoney(v, settings.currency || "R");
  const stmt = await getIncomeStatement(from, to);

  const rows = [
    ...stmt.revenue.map((l) => ({ label: l.label, code: l.code, amount: l.amount })),
    ...stmt.expenses.map((l) => ({ label: l.label, code: l.code, amount: l.amount })),
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Profit & loss"
        title="Income statement"
        action={
          <div className="flex items-end gap-2">
            <form method="get" className="flex items-end gap-2">
              <label className="block">
                <span className="mb-1.5 mr-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">From</span>
                <input type="date" name="from" defaultValue={from} className="rounded-md border border-rule-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest" />
              </label>
              <label className="block">
                <span className="mb-1.5 mr-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">To</span>
                <input type="date" name="to" defaultValue={to} className="rounded-md border border-rule-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest" />
              </label>
              <button className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-paper hover:bg-navy-2">Run</button>
            </form>
            <DownloadLinks
              csv={`/api/accounting/income-statement/csv?from=${from}&to=${to}`}
              pdf={`/api/accounting/income-statement/pdf?from=${from}&to=${to}`}
            />
          </div>
        }
      />

      <p className="mb-5 text-xs text-ink-soft">
        Profit and loss for the selected period. Revenue is net of VAT; VAT sits on the balance sheet.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-success">Revenue</div>
          <div className="mt-2 font-display text-2xl font-bold text-forest">{money(stmt.revenueTotal)}</div>
        </Card>
        <Card className="p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-rust">Expenses</div>
          <div className="mt-2 font-display text-2xl font-bold text-rust">{money(stmt.expenseTotal)}</div>
        </Card>
        <Card className={`p-5 ${stmt.netProfit >= 0 ? "bg-forest text-paper" : "bg-rust text-paper"}`}>
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] opacity-80">Net profit</div>
          <div className="mt-2 font-display text-2xl font-bold">{money(stmt.netProfit)}</div>
        </Card>
      </div>

      <h2 className="mt-8 mb-3 font-display text-lg font-bold text-navy">
        {from} → {to}
      </h2>
      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 text-left font-medium">Line</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.code}-${r.label}`} className="border-b border-rule last:border-b-0">
                  <td className="px-4 py-2 text-ink">
                    <span className="mr-3 inline-block w-12 font-mono text-ink-soft">{r.code ?? ""}</span>
                    <span className={r.amount >= 0 ? "font-medium" : "text-rust"}> {r.label}</span>
                  </td>
                  <td className={`px-4 py-2 text-right font-mono ${r.amount >= 0 ? "" : "text-rust"}`}>
                    {r.amount >= 0 ? money(r.amount) : `(${money(-r.amount)})`}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-navy bg-navy text-paper">
                <td className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em]">
                  {stmt.netProfit >= 0 ? "Net profit" : "Net loss"}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold">{money(stmt.netProfit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}