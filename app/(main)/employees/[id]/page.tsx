import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { employees } from "@/db/schema";
import { deleteEmployee, setEmployeeStatus } from "@/lib/actions/employees";
import { formatDate, formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { PageHeader, GhostLink, Card } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";

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

          <form action={remove}>
            <button className="w-full font-mono text-xs uppercase tracking-wide text-rust hover:underline">
              Delete employee
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}