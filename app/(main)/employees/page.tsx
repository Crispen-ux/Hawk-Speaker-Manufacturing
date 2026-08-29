import Link from "next/link";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import { getSettings } from "@/lib/numbering";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");
  const rows = await db.select().from(employees).orderBy(employees.lastName, employees.firstName);

  const filtered = status && status !== "all" ? rows.filter((r) => r.status === status) : rows;
  const filters = ["all", "active", "on_leave", "terminated"];

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Employees"
        action={<LinkButton href="/employees/new">+ Add employee</LinkButton>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/employees" : `/employees?status=${f}`}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wide ${
              (f === "all" && !status) || status === f
                ? "border-forest bg-forest text-paper"
                : "border-rule-strong text-ink-soft hover:bg-paper-dim"
            }`}
          >
            {f}
          </Link>
        ))}
        <span className="ml-auto font-mono text-xs text-ink-soft">
          On payroll: <span className="font-semibold text-ink">{rows.filter((r) => r.status === "active").length}</span>
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No employees" hint="Add your team so job cards, payroll and HR have people to use." action={<LinkButton href="/employees/new">Add an employee</LinkButton>} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Position</th>
                <th className="px-4 py-2.5 font-medium">Department</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 text-right font-medium">Salary</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="px-4 py-3">
                    <Link href={`/employees/${e.id}`} className="font-medium text-ink hover:text-forest">
                      {e.firstName} {e.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{e.position || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{e.department || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-soft">{e.email}</td>
                  <td className="px-4 py-3 text-right font-mono">{money(e.salary)}</td>
                  <td className="px-4 py-3 text-right">
                    <StatusStamp status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}