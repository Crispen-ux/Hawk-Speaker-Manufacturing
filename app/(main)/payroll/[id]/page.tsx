import Link from "next/link";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { payrollRuns, payrollEntries } from "@/db/schema";
import { deletePayrollRun, setPayrollStatus, updatePayrollEntry } from "@/lib/actions/payroll";
import { formatDate, formatMoney, toNumber } from "@/lib/money";
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
          <div className="overflow-x-auto rounded-lg border border-rule">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                  <th className="px-4 py-2.5 font-medium">Employee</th>
                  <th className="px-4 py-2.5 text-right font-medium">Salary</th>
                  <th className="px-4 py-2.5 text-right font-medium">Additions</th>
                  <th className="px-4 py-2.5 text-right font-medium">PAYE</th>
                  <th className="px-4 py-2.5 text-right font-medium">UIF</th>
                  <th className="px-4 py-2.5 text-right font-medium">Other</th>
                  <th className="px-4 py-2.5 text-right font-medium">Net</th>
                  <th className="px-4 py-2.5 text-right font-medium">Pay slip</th>
                </tr>
              </thead>
              <tbody>
                {run.entries.map((e) => {
                  const gross = toNumber(e.salary) + toNumber(e.additions);
                  const deductions = toNumber(e.tax) + toNumber(e.uif) + toNumber(e.otherDeductions);
                  const net = gross - deductions;
                  const field = `${inputClass} w-24 py-1 text-right font-mono`;
                  if (locked) {
                    return (
                      <tr key={e.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                        <td className="px-4 py-3">
                          <Link href={`/employees/${e.employeeId}`} className="font-medium text-ink hover:text-forest">
                            {e.employee.firstName} {e.employee.lastName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{money(e.salary)}</td>
                        <td className="px-4 py-3 text-right font-mono text-ink-soft">{money(e.additions)}</td>
                        <td className="px-4 py-3 text-right font-mono">{money(e.tax)}</td>
                        <td className="px-4 py-3 text-right font-mono">{money(e.uif)}</td>
                        <td className="px-4 py-3 text-right font-mono text-ink-soft">{money(e.otherDeductions)}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-success">{money(net)}</td>
                        <td className="px-4 py-3 text-right">
                          <a href={`/api/payroll/payslip/${e.id}`} target="_blank" className="font-mono text-xs text-forest hover:underline">PDF</a>
                        </td>
                      </tr>
                    );
                  }
                  const save = updatePayrollEntry.bind(null, e.id);
                  const rowForm = `pay-entry-${e.id}`;
                  return (
                    <tr key={e.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                      <td className="px-4 py-3">
                        <form id={rowForm} action={save} className="hidden" aria-hidden="true" />
                        <Link href={`/employees/${e.employeeId}`} className="font-medium text-ink hover:text-forest">
                          {e.employee.firstName} {e.employee.lastName}
                        </Link>
                      </td>
                      <td className="px-2 py-3 text-right"><input name="salary" form={rowForm} defaultValue={e.salary} className={field} inputMode="decimal" /></td>
                      <td className="px-2 py-3 text-right"><input name="additions" form={rowForm} defaultValue={e.additions} className={field} inputMode="decimal" /></td>
                      <td className="px-2 py-3 text-right"><input name="tax" form={rowForm} defaultValue={e.tax} className={field} inputMode="decimal" /></td>
                      <td className="px-2 py-3 text-right"><input name="uif" form={rowForm} defaultValue={e.uif} className={field} inputMode="decimal" /></td>
                      <td className="px-2 py-3 text-right"><input name="other" form={rowForm} defaultValue={e.otherDeductions} className={field} inputMode="decimal" /></td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{money(net)}</td>
                      <td className="px-2 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button form={rowForm} type="submit" className="font-mono text-xs text-forest hover:underline">save</button>
                          <a href={`/api/payroll/payslip/${e.id}`} target="_blank" className="font-mono text-xs text-forest hover:underline">PDF</a>
                        </div>
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