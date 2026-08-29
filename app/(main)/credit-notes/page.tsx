import Link from "next/link";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import { calcTotals } from "@/lib/money";
import { formatDate, formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export default async function CreditNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");
  const rows = await db.query.creditNotes.findMany({
    with: { client: true, items: true, invoice: true },
    orderBy: (creditNotes, { desc }) => [desc(creditNotes.createdAt)],
  });

  const computed = rows.map((r) => ({ ...r, computed: calcTotals(r.items, r.taxRate, r.discount) }));
  const filtered = status ? computed.filter((r) => r.status === status) : computed;
  const filters = ["all", "draft", "issued", "applied", "cancelled"];

  return (
    <div>
      <PageHeader
        eyebrow="Accounts receivable"
        title="Credit notes"
        action={<LinkButton href="/credit-notes/new">+ New credit note</LinkButton>}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/credit-notes" : `/credit-notes?status=${f}`}
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
          title="No credit notes here"
          hint="Issue a credit note to refund or adjust an invoice."
          action={<LinkButton href="/credit-notes/new">Create a credit note</LinkButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Applies to</th>
                <th className="px-4 py-2.5 font-medium">Issued</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cn) => (
                <tr key={cn.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="px-4 py-3">
                    <Link href={`/credit-notes/${cn.id}`} className="font-mono font-medium text-ink hover:text-forest">
                      {cn.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{cn.client?.name}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {cn.invoice ? (
                      <Link href={`/invoices/${cn.invoice.id}`} className="font-mono hover:text-forest">
                        {cn.invoice.number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(cn.issueDate)}</td>
                  <td className="px-4 py-3 text-right font-mono">{money(cn.computed.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <StatusStamp status={cn.status} />
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