import Link from "next/link";
import { db } from "@/db";
import { invoices, payments, expenses, clients } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { PageHeader, Card } from "@/components/ui";
import { calcTotals, formatMoney, toNumber } from "@/lib/money";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

function monthKey(date: string): string {
  return date.slice(0, 7);
}

export default async function ReportsPage() {
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const [invRows, paymentRows, expenseRows] = await Promise.all([
    db.query.invoices.findMany({ with: { items: true, payments: true } }),
    db.select().from(payments),
    db.select().from(expenses),
  ]);

  const clientIds = Array.from(new Set(invRows.map((r) => r.clientId)));
  const clientRows = clientIds.length
    ? await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds))
    : [];
  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));

  const invMeta = invRows.map((inv) => {
    const { total } = calcTotals(inv.items, inv.taxRate, inv.discount);
    const paid = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
    return { inv, total, paid, balance: Math.max(total - paid, 0) };
  });
  const active = invMeta.filter((r) => r.inv.status !== "cancelled");

  const totalInvoiced = active.reduce((s, r) => s + r.total, 0);
  const collected = paymentRows.reduce((s, p) => s + toNumber(p.amount), 0);
  const outstanding = active.reduce((s, r) => s + r.balance, 0);
  const totalExpenses = expenseRows.reduce((s, e) => s + Number(e.amount || 0), 0);

  // Last 6 months in/month-out (based on invoice issue date and payment date).
  const months: { key: string; label: string; invoiced: number; collected: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-ZA", { month: "short" });
    months.push({ key, label, invoiced: 0, collected: 0 });
  }
  for (const r of active) {
    const m = months.find((x) => x.key === monthKey(r.inv.issueDate));
    if (m) m.invoiced += r.total;
  }
  for (const p of paymentRows) {
    const m = months.find((x) => x.key === monthKey(p.date));
    if (m) m.collected += toNumber(p.amount);
  }
  const maxMonth = Math.max(1, ...months.map((m) => Math.max(m.invoiced, m.collected)));

  const byClient = new Map<number, { name: string; total: number; outstanding: number }>();
  for (const r of active) {
    const row = byClient.get(r.inv.clientId) ?? {
      name: clientName.get(r.inv.clientId) ?? "Unknown",
      total: 0,
      outstanding: 0,
    };
    row.total += r.total;
    row.outstanding += r.balance;
    byClient.set(r.inv.clientId, row);
  }
  const topClients = Array.from(byClient.values()).sort((a, b) => b.total - a.total).slice(0, 5);

  const kpis = [
    { label: "Total invoiced", value: totalInvoiced, tone: "text-navy" },
    { label: "Collected", value: collected, tone: "text-success" },
    { label: "Outstanding", value: outstanding, tone: "text-rust" },
    { label: "Expenses", value: totalExpenses, tone: "text-navy" },
  ];

  return (
    <div>
      <PageHeader eyebrow="Analytics" title="Reports" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">{k.label}</div>
            <div className={`mt-2 font-display text-2xl font-bold ${k.tone}`}>{money(k.value)}</div>
          </Card>
        ))}
      </div>

      <h2 className="mt-10 mb-3 font-display text-lg font-bold text-navy">Last 6 months</h2>
      <Card className="p-5">
        <div className="flex h-48 items-end gap-4 px-2">
          {months.map((m) => (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end justify-center gap-1">
                <div
                  className="w-4 rounded-t bg-navy/80"
                  style={{ height: `${Math.round((m.invoiced / maxMonth) * 100)}%` }}
                  title={`Invoiced ${money(m.invoiced)}`}
                />
                <div
                  className="w-4 rounded-t bg-success"
                  style={{ height: `${Math.round((m.collected / maxMonth) * 100)}%` }}
                  title={`Collected ${money(m.collected)}`}
                />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-soft">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 border-t border-rule pt-3 font-mono text-[10px] uppercase tracking-wide text-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-navy/80" /> Invoiced
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-success" /> Collected
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 mt-10 font-display text-lg font-bold text-navy">Top clients by value</h2>
          {topClients.length === 0 ? (
            <p className="text-sm text-ink-soft">No invoicing yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-rule">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                    <th className="px-4 py-2.5 font-medium">Client</th>
                    <th className="px-4 py-2.5 text-right font-medium">Invoiced</th>
                    <th className="px-4 py-2.5 text-right font-medium">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.map((c) => (
                    <tr key={c.name} className="border-b border-rule last:border-b-0">
                      <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                      <td className="px-4 py-3 text-right font-mono">{money(c.total)}</td>
                      <td className="px-4 py-3 text-right font-mono">{money(c.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 mt-10 font-display text-lg font-bold text-navy">Tax</h2>
          <Card className="p-5">
            <div className="flex flex-col gap-2">
              <Link
                href="/reports/vat"
                className="rounded-md border border-rule px-3 py-2 font-mono text-xs text-forest hover:border-forest"
              >
                VAT report (PDF / CSV)
              </Link>
            </div>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 mt-10 font-display text-lg font-bold text-navy">Exports</h2>
          <Card className="p-5">
            <p className="mb-4 text-xs text-ink-soft">
              Full data sets as CSV for spreadsheets and accountants.
            </p>
            <div className="flex flex-col gap-2">
              {[
                ["invoices", "Invoices"],
                ["payments", "Payments"],
                ["expenses", "Expenses"],
              ].map(([kind, label]) => (
                <Link
                  key={kind}
                  href={`/api/reports/export/${kind}`}
                  className="rounded-md border border-rule px-3 py-2 font-mono text-xs text-forest hover:border-forest"
                >
                  Export {label} (CSV)
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}