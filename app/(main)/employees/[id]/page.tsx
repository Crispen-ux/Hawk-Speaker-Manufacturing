import { db } from "@/db";
import { eq, inArray, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { employees, payrollEntries, payrollRuns } from "@/db/schema";
import { deleteEmployee, setEmployeeStatus } from "@/lib/actions/employees";
import { formatDate, formatMoney, toNumber } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { PageHeader, GhostLink, Card } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import ConfirmForm from "@/components/ConfirmForm";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employeeId = Number(id);
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId));
  if (!employee) notFound();
  const remove = deleteEmployee.bind(null, employeeId);
  const setStatus = setEmployeeStatus.bind(null, employeeId);

  const entries = await db
    .select()
    .from(payrollEntries)
    .where(eq(payrollEntries.employeeId, employeeId))
    .orderBy(desc(payrollEntries.id))
    .limit(12);
  const runIds = [...new Set(entries.map((e) => e.runId))];
  const runs = runIds.length
    ? await db.select().from(payrollRuns).where(inArray(payrollRuns.id, runIds))
    : [];
  const runByEntry = new Map(entries.map((e) => [e.id, runs.find((r) => r.id === e.runId)]));
  const slips = entries
    .filter((e) => runByEntry.get(e.id))
    .sort((a, b) => (runByEntry.get(b.id)!.payDate < runByEntry.get(a.id)!.payDate ? -1 : 1));

  return (
    <div>
      <PageHeader
        eyebrow={employee.position || "Employee"}
        title={`${employee.firstName} ${employee.lastName}`}
        action={
          <div className="flex items-center gap-2">
            <StatusStamp status={employee.status} />
            <GhostLink href={`/employees/${employeeId}/edit`}>Edit</GhostLink>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <Card>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Department</div>
                <div className="text-ink">{employee.department || "—"}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Salary</div>
                <div className="text-ink">{money(employee.salary)}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Started</div>
                <div className="text-ink">{employee.startDate ? formatDate(employee.startDate) : "—"}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">ID number</div>
                <div className="font-mono text-ink">{employee.idNumber || "—"}</div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-rule pt-4 text-sm text-ink-soft">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Email</div>
                <a href={`mailto:${employee.email}`} className="text-forest hover:underline">
                  {employee.email}
                </a>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Phone</div>
                <div>{employee.phone || "—"}</div>
              </div>
            </div>
            {employee.notes && (
              <div className="mt-4 text-sm text-ink-soft">{employee.notes}</div>
            )}
          </Card>

          <h2 className="mb-3 mt-8 font-display text-lg font-bold text-navy">Payslips ({slips.length})</h2>
          {slips.length === 0 ? (
            <p className="text-sm text-ink-soft">No pay slips yet — they appear once the employee is included in a payroll run.</p>
          ) : (
            <Card className="divide-y divide-rule">
              {slips.map((e) => {
                const run = runByEntry.get(e.id)!;
                const net =
                  toNumber(e.salary) +
                  toNumber(e.additions) -
                  toNumber(e.tax) -
                  toNumber(e.uif) -
                  toNumber(e.otherDeductions);
                return (
                  <div key={e.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <div className="font-mono text-xs text-ink-soft">
                        {formatDate(run.payDate)} · {formatDate(run.periodStart)} → {formatDate(run.periodEnd)}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusStamp status={run.status} />
                        <a href={`/api/payroll/payslip/${e.id}`} target="_blank" className="font-mono text-xs text-forest hover:underline">
                          download PDF
                        </a>
                        <a href={`/payroll/${run.id}`} className="font-mono text-xs text-ink-soft hover:text-forest hover:underline">
                          run #{run.id}
                        </a>
                      </div>
                    </div>
                    <div className="text-right font-mono font-semibold">{money(net)}</div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Status</h3>
            <div className="flex flex-wrap gap-2">
              {(["active", "on_leave", "terminated"] as const).map((s) => (
                <form key={s} action={setStatus.bind(null, s)}>
                  <button className="rounded-full border border-rule-strong px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-ink-soft hover:border-forest hover:text-forest">
                    mark {s}
                  </button>
                </form>
              ))}
            </div>
          </Card>

          <ConfirmForm action={remove} confirm="Delete this employee? Their payroll and leave records go with them.">
            <button className="w-full font-mono text-xs uppercase tracking-wide text-rust hover:underline">
              Delete employee
            </button>
          </ConfirmForm>
        </div>
      </div>
    </div>
  );
}