import { db } from "@/db";
import Link from "next/link";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import { formatDate } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function JobCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const rows = await db.query.jobCards.findMany({
    with: { client: true },
    orderBy: (jobCards, { desc }) => [desc(jobCards.createdAt)],
  });

  const filtered = status ? rows.filter((r) => r.status === status) : rows;
  const filters = ["all", "open", "in_progress", "completed", "invoiced", "cancelled"];

  return (
    <div>
      <PageHeader
        eyebrow="Field work"
        title="Job cards"
        action={<LinkButton href="/job-cards/new">+ New job card</LinkButton>}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/job-cards" : `/job-cards?status=${f}`}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wide ${
              (f === "all" && !status) || status === f
                ? "border-forest bg-forest text-paper"
                : "border-rule-strong text-ink-soft hover:bg-paper-dim"
            }`}
          >
            {f.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No job cards here"
          hint="Open a job card to track work for a client — labour, parts, and technician notes — before invoicing it."
          action={<LinkButton href="/job-cards/new">Create a job card</LinkButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Opened</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <tr key={job.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="px-4 py-3">
                    <Link href={`/job-cards/${job.id}`} className="font-mono font-medium text-ink hover:text-forest">
                      {job.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{job.title}</td>
                  <td className="px-4 py-3">{job.client?.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(job.openedDate)}</td>
                  <td className="px-4 py-3 text-right">
                    <StatusStamp status={job.status} />
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
