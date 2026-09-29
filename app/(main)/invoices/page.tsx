import { db } from "@/db";
import Link from "next/link";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import { formatDate, formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { computeInvoice } from "@/lib/calc";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");
  const rows = await db.query.invoices.findMany({
    with: { client: true, items: true, payments: true },
    orderBy: (invoices, { desc }) => [desc(invoices.createdAt)],
  });

  const computed = rows.map((r) => ({ ...r, computed: computeInvoice(r, r.items, r.payments) }));
  const filtered = status ? computed.filter((r) => r.computed.effectiveStatus === status) : computed;

  const filters = ["all", "draft", "sent", "partial", "paid", "overdue", "cancelled"];

  return (
    <div>
      <PageHeader
        eyebrow="Accounts receivable"
        title="Invoices"
        action={<LinkButton href="/invoices/new">+ New invoice</LinkButton>}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/invoices" : `/invoices?status=${f}`}
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
          title="No invoices here"
          hint="Create an invoice to start billing a client."
          action={<LinkButton href="/invoices/new">Create an invoice</LinkButton>}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-rule">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Issued</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Due</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="px-4 py-3">
                    <Link href={`/invoices/${inv.id}`} className="font-mono font-medium text-ink hover:text-forest">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{inv.client?.name}</td>
                  <td className="hidden px-4 py-3 text-ink-soft md:table-cell">{formatDate(inv.issueDate)}</td>
                  <td className="hidden px-4 py-3 text-ink-soft md:table-cell">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-right font-mono">{money(inv.computed.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <StatusStamp status={inv.computed.effectiveStatus} />
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
