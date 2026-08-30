import Link from "next/link";
import { db } from "@/db";
import { journalEntries } from "@/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader, LinkButton, EmptyState, Card } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export default async function JournalListPage() {
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");
  const rows = await db.query.journalEntries.findMany({
    with: { lines: true },
    orderBy: [desc(journalEntries.date), desc(journalEntries.id)],
  });

  const totalDebits = rows.reduce(
    (s, r) => s + r.lines.reduce((t, l) => t + Number(l.debit || 0), 0),
    0
  );
  const totalCredits = rows.reduce(
    (s, r) => s + r.lines.reduce((t, l) => t + Number(l.credit || 0), 0),
    0
  );

  return (
    <div>
      <PageHeader
        eyebrow="General ledger"
        title="Journal entries"
        action={<LinkButton href="/accounting/journal/new">+ New entry</LinkButton>}
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No journal entries yet"
            hint="Record opening balances, owner contributions, drawings or corrections that your invoices and expenses don't cover."
            action={<LinkButton href="/accounting/journal/new">Post your first entry</LinkButton>}
          />
        </Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule bg-paper-dim font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                  <th className="px-4 py-2.5 text-left font-medium">Number</th>
                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium">Kind</th>
                  <th className="px-4 py-2.5 text-left font-medium">Memo</th>
                  <th className="px-4 py-2.5 text-right font-medium">Debit</th>
                  <th className="px-4 py-2.5 text-right font-medium">Credit</th>
                </tr>
              </thead>
              {rows.map((r) => {
                const debit = r.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
                const credit = r.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
                return (
                  <tbody key={r.id}>
                    <tr className="border-b border-rule hover:bg-paper-dim/50 last:border-b-0">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/accounting/journal/${r.id}`}
                          className="font-mono font-medium text-forest hover:underline"
                        >
                          {r.number}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft">{formatDate(r.date)}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                            r.kind === "opening"
                              ? "bg-sky/10 text-sky"
                              : "bg-paper-dim text-ink-soft"
                          }`}
                        >
                          {r.kind}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-ink">
                        <span className="font-medium">{r.memo}</span>
                        {r.reference ? (
                          <span className="ml-2 font-mono text-xs text-ink-soft">{r.reference}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{money(debit)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{money(credit)}</td>
                    </tr>
                  </tbody>
                );
              })}
              <tfoot>
                <tr className="border-t-2 border-navy bg-navy text-paper">
                  <td colSpan={4} className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em]">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{money(totalDebits)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{money(totalCredits)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}