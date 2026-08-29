import Link from "next/link";
import { db } from "@/db";
import { payrollRuns, payrollEntries } from "@/db/schema";
import { desc, inArray } from "drizzle-orm";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import { formatDate, formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const runs = await db.select().from(payrollRuns).orderBy(desc(payrollRuns.payDate));
  const runIds = runs.map((r) => r.id);
  const entries = runIds.length ? await db.select().from(payrollEntries).where(inArray(payrollEntries.runId, runIds)) : [];
  const totalByRun = new Map<number, number>();
  for (const e of entries) totalByRun.set(e.runId, (totalByRun.get(e.runId) ?? 0) + Number(e.salary || 0));

  return (
    <div>
      <PageHeader
        eyebrow="Salaries"
        title="Payroll"
        action={<LinkButton href="/payroll/new">+ New payroll run</LinkButton>}
      />

      {runs.length === 0 ? (
        <EmptyState title="No payroll runs" hint="Create a run and it automatically includes every active employee at their current salary." action={<LinkButton href="/payroll/new">Start a payroll run</LinkButton>} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Run</th>
                <th className="px-4 py-2.5 font-medium">Period</th>
                <th className="px-4 py-2.5 font-medium">Pay date</th>
                <th className="px-4 py-2.5 text-right font-medium">Gross</th>
                <th className="px-4 py-2.5 text-right font-medium">Staff</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const staff = entries.filter((e) => e.runId === r.id).length;
                return (
                  <tr key={r.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                    <td className="px-4 py-3">
                      <Link href={`/payroll/${r.id}`} className="font-medium text-ink hover:text-forest">
                        Run #{r.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {formatDate(r.periodStart)} → {formatDate(r.periodEnd)}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{formatDate(r.payDate)}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(totalByRun.get(r.id) ?? 0)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-ink-soft">{staff}</td>
                    <td className="px-4 py-3 text-right">
                      <StatusStamp status={r.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}