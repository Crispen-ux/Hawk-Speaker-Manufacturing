import Link from "next/link";
import { db } from "@/db";
import { contracts, leaveRequests } from "@/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import { formatDate } from "@/lib/money";
import { deleteContract, setLeaveStatus } from "@/lib/actions/hr";

export const dynamic = "force-dynamic";

export default async function HRPage() {
  const [contractRows, leaveRows] = await Promise.all([
    db.query.contracts.findMany({
      with: { employee: true },
      orderBy: desc(contracts.createdAt),
    }),
    db.query.leaveRequests.findMany({
      with: { employee: true },
      orderBy: desc(leaveRequests.createdAt),
    }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="People operations"
        title="HR"
        action={
          <div className="flex gap-2">
            <LinkButton href="/hr/contracts/new">+ Contract</LinkButton>
            <LinkButton href="/hr/leave/new">Request leave</LinkButton>
          </div>
        }
      />

      <h2 className="mb-3 font-display text-lg font-bold text-navy">Contracts ({contractRows.length})</h2>
      {contractRows.length === 0 ? (
        <EmptyState title="No contracts" hint="Add employment contracts so leave and payroll have a basis." action={<LinkButton href="/hr/contracts/new">Add a contract</LinkButton>} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Started</th>
                <th className="px-4 py-2.5 font-medium">Ends</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contractRows.map((c) => {
                const remove = deleteContract.bind(null, c.id);
                return (
                  <tr key={c.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                    <td className="px-4 py-3">
                      <Link href={`/employees/${c.employeeId}`} className="font-medium text-ink hover:text-forest">
                        {c.employee.firstName} {c.employee.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{c.type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-ink-soft">{formatDate(c.startDate)}</td>
                    <td className="px-4 py-3 text-ink-soft">{c.endDate ? formatDate(c.endDate) : "Open-ended"}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={remove}>
                        <button className="font-mono text-xs text-rust hover:underline">remove</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-10 mb-3 font-display text-lg font-bold text-navy">Leave requests ({leaveRows.length})</h2>
      {leaveRows.length === 0 ? (
        <EmptyState title="No leave requests" hint="Team members can be logged off on annual, sick or family leave." action={<LinkButton href="/hr/leave/new">Request leave</LinkButton>} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">From</th>
                <th className="px-4 py-2.5 font-medium">To</th>
                <th className="px-4 py-2.5 text-right font-medium">Days</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Review</th>
              </tr>
            </thead>
            <tbody>
              {leaveRows.map((l) => (
                <tr key={l.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="px-4 py-3">
                    <Link href={`/employees/${l.employeeId}`} className="font-medium text-ink hover:text-forest">
                      {l.employee.firstName} {l.employee.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{l.type}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(l.fromDate)}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(l.toDate)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-ink-soft">{l.days}</td>
                  <td className="px-4 py-3 text-right">
                    <StatusStamp status={l.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {l.status === "pending" ? (
                      <div className="flex justify-end gap-3">
                        <form action={setLeaveStatus.bind(null, l.id, "approved")}>
                          <button className="font-mono text-xs text-success hover:underline">approve</button>
                        </form>
                        <form action={setLeaveStatus.bind(null, l.id, "rejected")}>
                          <button className="font-mono text-xs text-rust hover:underline">reject</button>
                        </form>
                      </div>
                    ) : (
                      <span className="font-mono text-xs text-ink-soft">—</span>
                    )}
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