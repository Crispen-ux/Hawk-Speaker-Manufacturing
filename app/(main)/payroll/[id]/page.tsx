import Link from "next/link";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { payrollRuns, payrollEntries } from "@/db/schema";
import { deletePayrollRun, setPayrollStatus, updatePayrollEntry } from "@/lib/actions/payroll";
import { formatDate, formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { PageHeader, GhostLink, Card, inputClass, PrimaryButton } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import ConfirmForm from "@/components/ConfirmForm";

export const dynamic = "force-dynamic";

export default async function PayrollRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runId = Number(id);
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const run = await db.query.payrollRuns.findFirst({
    where: eq(payrollRuns.id, runId),
    with: { entries: { with: { employee: true } } },
  });
  if (!run) notFound();

  const gross = run.entries.reduce((s, e) => s + Number(e.salary || 0), 0);
  const locked = run.status === "paid";
  const remove = deletePayrollRun.bind(null, runId);

  return (
    <div>
      <PageHeader
        eyebrow="Salaries"
        title={`Payroll run #${run.id}`}
        action={
          <div className="flex items-center gap-2">
            <StatusStamp status={run.status} />
            <GhostLink href="/payroll">All runs</GhostLink>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <Card>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Period</div>
                <div className="text-ink">
                  {formatDate(run.periodStart)} → {formatDate(run.periodEnd)}
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Pay date</div>
                <div className="text-ink">{formatDate(run.payDate)}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Staff</div>
                <div className="text-ink">{run.entries.length}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Gross</div>
                <div className="text-ink">{money(gross)}</div>
              </div>
            </div>
            {run.notes && <div className="mt-4 border-t border-rule pt-4 text-sm text-ink-soft">{run.notes}</div>}
          </Card>

          <h2 className="mb-3 mt-8 font-display text-lg font-bold text-navy">Payroll entries ({run.entries.length})</h2>
          <div className="overflow-hidden rounded-lg border border-rule">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                  <th className="px-4 py-2.5 font-medium">Employee</th>
                  <th className="px-4 py-2.5 font-medium">Position</th>
                  <th className="px-4 py-2.5 text-right font-medium">Salary for this run</th>
                </tr>
              </thead>
              <tbody>
                {run.entries.map((e) => {
                  const save = updatePayrollEntry.bind(null, e.id);
                  return (
                    <tr key={e.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                      <td className="px-4 py-3">
                        <Link href={`/employees/${e.employeeId}`} className="font-medium text-ink hover:text-forest">
                          {e.employee.firstName} {e.employee.lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{e.employee.position || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {locked ? (
                          <span className="font-mono">{money(e.salary)}</span>
                        ) : (
                          <form action={save} className="inline-flex items-center gap-2">
                            <input name="salary" defaultValue={e.salary} className={`${inputClass} w-32 py-1 text-right font-mono`} inputMode="decimal" />
                            <button className="font-mono text-xs text-forest hover:underline">save</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Run status</h3>
            {locked ? (
              <p className="text-sm text-ink-soft">This run has been marked paid — entries are locked from editing.</p>
            ) : (
              <>
                <p className="mb-3 text-xs text-ink-soft">
                  Mark the run as paid once salaries have been dispatched. Editing locks afterwards.
                </p>
                <form action={setPayrollStatus.bind(null, run.id, "paid")}>
                  <PrimaryButton type="submit">Mark as paid</PrimaryButton>
                </form>
              </>
            )}
          </Card>

          {!locked && (
            <ConfirmForm action={remove} confirm="Delete this payroll run? This can't be undone.">
              <button className="w-full font-mono text-xs uppercase tracking-wide text-rust hover:underline">
                Delete run
              </button>
            </ConfirmForm>
          )}
        </div>
      </div>
    </div>
  );
}