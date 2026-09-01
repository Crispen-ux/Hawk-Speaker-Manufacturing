import { requireActivePortalUser } from "@/lib/auth-portal";
import { db } from "@/db";
import { invoices, creditNotes } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { formatMoney, formatDate, calcTotals, toNumber } from "@/lib/money";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

function yearStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function PortalStatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireActivePortalUser();
  const { from, to } = await searchParams;
  const fromDate = from || yearStart();
  const toDate = to || today();

  const settings = await getSettings();
  const fmt = (n: string | number) => formatMoney(n, settings.currency || "R");

  const [invRows, cnRows] = await Promise.all([
    db.query.invoices.findMany({
      where: and(
        eq(invoices.clientId, session.clientId),
        gte(invoices.issueDate, fromDate),
        lte(invoices.issueDate, toDate)
      ),
      with: { items: true, payments: true },
      orderBy: (t, { asc }) => [asc(t.issueDate)],
    }),
    db.query.creditNotes.findMany({
      where: and(
        eq(creditNotes.clientId, session.clientId),
        gte(creditNotes.issueDate, fromDate),
        lte(creditNotes.issueDate, toDate)
      ),
      with: { items: true },
      orderBy: (t, { asc }) => [asc(t.issueDate)],
    }),
  ]);

  const rows: Array<{ date: string; ref: string; kind: "Invoice" | "Credit note"; amount: number; paid: number; balance: number }> = [];
  invRows.forEach((inv) => {
    const { total } = calcTotals(inv.items, inv.taxRate, inv.discount);
    const paid = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
    rows.push({ date: inv.issueDate, ref: inv.number, kind: "Invoice", amount: total, paid, balance: Math.max(total - paid, 0) });
  });
  cnRows.forEach((cn) => {
    const { total } = calcTotals(cn.items, cn.taxRate, cn.discount);
    rows.push({ date: cn.issueDate, ref: cn.number, kind: "Credit note" as const, amount: -total, paid: 0, balance: -total });
  });
  const sorted = rows.sort((a, b) => a.date.localeCompare(b.date));
  const outstanding = sorted.reduce((s, r) => s + r.balance, 0);

  return (
    <div>
      <PageHeader eyebrow="Client portal" title="Statements" />
      <form className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-rule bg-white p-4">
        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">From</span>
          <input name="from" type="date" defaultValue={fromDate} className="rounded-md border border-rule-strong px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">To</span>
          <input name="to" type="date" defaultValue={toDate} className="rounded-md border border-rule-strong px-3 py-2 text-sm" />
        </label>
        <button className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-paper hover:bg-navy-2" type="submit">
          Run statement
        </button>
      </form>

      {sorted.length === 0 ? (
        <EmptyState title="Nothing in this period" hint="No invoices or credit notes in the selected range." />
      ) : (
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-rule bg-paper-dim/60">
              <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={`${r.kind}-${r.ref}`} className="border-b border-rule last:border-0">
                  <td className="px-4 py-3 text-ink-soft">{formatDate(r.date)}</td>
                  <td className="px-4 py-3 font-medium text-ink">{r.ref}</td>
                  <td className="px-4 py-3 text-ink-soft">{r.kind}</td>
                  <td className="px-4 py-3 text-right font-medium text-navy">{fmt(r.amount)}</td>
                  <td className="px-4 py-3 text-right text-ink-soft">{fmt(r.paid)}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(r.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-rule bg-paper-dim/40">
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-navy">
                  Outstanding
                </td>
                <td className="px-4 py-3 text-right font-display text-base font-extrabold text-navy">{fmt(outstanding)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </div>
  );
}