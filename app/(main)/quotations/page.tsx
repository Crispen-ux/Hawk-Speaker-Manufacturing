import { db } from "@/db";
import Link from "next/link";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import { formatDate, formatMoney } from "@/lib/money";
import { computeQuotation } from "@/lib/calc";

export const dynamic = "force-dynamic";

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const rows = await db.query.quotations.findMany({
    with: { client: true, items: true },
    orderBy: (quotations, { desc }) => [desc(quotations.createdAt)],
  });

  const computed = rows.map((r) => ({ ...r, totals: computeQuotation(r, r.items) }));
  const filtered = status ? computed.filter((r) => r.status === status) : computed;
  const filters = ["all", "draft", "sent", "accepted", "declined", "expired"];

  return (
    <div>
      <PageHeader
        eyebrow="Proposals"
        title="Quotations"
        action={<LinkButton href="/quotations/new">+ New quotation</LinkButton>}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/quotations" : `/quotations?status=${f}`}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wide ${
              (f === "all" && !status) || status === f
                ? "border-forest bg-forest text-paper"
                : "border-rule-strong text-ink-soft hover:bg-paper-dim"
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No quotations here"
          hint="Draft a quotation to propose scope and price before you invoice."
          action={<LinkButton href="/quotations/new">Create a quotation</LinkButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Issued</th>
                <th className="px-4 py-2.5 font-medium">Expires</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="px-4 py-3">
                    <Link href={`/quotations/${q.id}`} className="font-mono font-medium text-ink hover:text-forest">
                      {q.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{q.client?.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(q.issueDate)}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(q.expiryDate)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatMoney(q.totals.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <StatusStamp status={q.status} />
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
