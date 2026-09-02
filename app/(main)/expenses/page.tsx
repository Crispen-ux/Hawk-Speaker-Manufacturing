import Link from "next/link";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import StatusStamp from "@/components/StatusStamp";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string }>;
}) {
  const { category, status } = await searchParams;
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");
  const rows = await db.query.expenses.findMany({
    with: { supplier: true, jobCard: true },
    orderBy: desc(expenses.date),
  });

  const categories = Array.from(new Set(rows.map((r) => r.category).filter((c): c is string => Boolean(c))));
  const filtered = category && category !== "all" ? rows.filter((r) => r.category === category) : rows;
  const statusFiltered = status && status !== "all" ? filtered.filter((r) => r.status === status) : filtered;
  const total = statusFiltered.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Money out"
        title="Expenses"
        action={<LinkButton href="/expenses/new">+ Record expense</LinkButton>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href="/expenses"
          className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wide ${
            !status || status === "all"
              ? "border-forest bg-forest text-paper"
              : "border-rule-strong text-ink-soft hover:bg-paper-dim"
          }`}
        >
          all
        </Link>
        {(["submitted", "approved", "rejected"] as const).map((s) => (
          <Link
            key={s}
            href={`/expenses?status=${s}`}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wide ${
              status === s ? "border-forest bg-forest text-paper" : "border-rule-strong text-ink-soft hover:bg-paper-dim"
            }`}
          >
            {s}
          </Link>
        ))}
        <span className="ml-auto font-mono text-xs text-ink-soft">
          Total: <span className="font-semibold text-ink">{money(total)}</span>
        </span>
      </div>

      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-soft">Category:</span>
          <Link
            href={`/expenses${status ? `?status=${status}` : ""}`}
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
              !category || category === "all"
                ? "border-forest bg-forest text-paper"
                : "border-rule-strong text-ink-soft hover:bg-paper-dim"
            }`}
          >
            all
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={`/expenses?category=${encodeURIComponent(c)}${status ? `&status=${status}` : ""}`}
              className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                category === c ? "border-forest bg-forest text-paper" : "border-rule-strong text-ink-soft hover:bg-paper-dim"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>
      )}

      {statusFiltered.length === 0 ? (
        <EmptyState title="No expenses recorded" hint="Track business outgoings here — materials, fuel, rent and more." action={<LinkButton href="/expenses/new">Record an expense</LinkButton>} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Job card</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {statusFiltered.map((e) => (
                <tr key={e.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="px-4 py-3">
                    <Link href={`/expenses/${e.id}`} className="font-medium text-ink hover:text-forest">
                      {e.description}
                    </Link>
                    <div className="text-xs text-ink-soft">{e.supplier?.name || ""}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(e.date)}</td>
                  <td className="px-4 py-3 text-ink-soft">{e.category || "—"}</td>
                  <td className="px-4 py-3">
                    {e.jobCard ? (
                      <Link href={`/job-cards/${e.jobCardId}`} className="text-forest hover:underline text-xs font-mono">
                        {e.jobCard.number}
                      </Link>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusStamp status={e.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{money(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
