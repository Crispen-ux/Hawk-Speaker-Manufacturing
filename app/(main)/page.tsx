import { db } from "@/db";
import Link from "next/link";
import { PageHeader, Card, LinkButton, EmptyState } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import { formatDate, formatMoney, toNumber } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { computeInvoice } from "@/lib/calc";

export const dynamic = "force-dynamic";

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card>
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">{label}</div>
      <div className={`mt-2 font-display text-3xl font-extrabold tracking-tight ${accent ?? "text-navy"}`}>{value}</div>
    </Card>
  );
}

export default async function DashboardPage() {
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");
  const allInvoices = await db.query.invoices.findMany({
    with: { client: true, items: true, payments: true },
    orderBy: (invoices, { desc }) => [desc(invoices.createdAt)],
  });

  if (allInvoices.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Overview" title="Dashboard" />
        <EmptyState
          title="The ledger is empty"
          hint="Add a client and raise your first invoice to see your numbers here."
          action={<LinkButton href="/clients/new">Add a client</LinkButton>}
        />
      </div>
    );
  }

  const computed = allInvoices.map((inv) => ({ ...inv, computed: computeInvoice(inv, inv.items, inv.payments) }));

  const outstanding = computed
    .filter((i) => i.computed.effectiveStatus !== "cancelled")
    .reduce((s, i) => s + i.computed.balance, 0);

  const overdue = computed.filter((i) => i.computed.effectiveStatus === "overdue");
  const overdueTotal = overdue.reduce((s, i) => s + i.computed.balance, 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidThisMonth = allInvoices
    .flatMap((inv) => inv.payments)
    .filter((p) => new Date(p.date) >= monthStart)
    .reduce((s, p) => s + toNumber(p.amount), 0);

  const draftCount = computed.filter((i) => i.computed.effectiveStatus === "draft").length;

  const recent = computed.slice(0, 8);

  return (
    <div>
      <PageHeader eyebrow="Overview" title="Dashboard" />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Stat label="Outstanding" value={money(outstanding)} />
        <Stat label="Overdue" value={money(overdueTotal)} accent={overdueTotal > 0 ? "text-rust" : undefined} />
        <Stat label="Paid this month" value={money(paidThisMonth)} accent="text-success" />
        <Stat label="Drafts" value={String(draftCount)} />
      </div>

      {overdue.length > 0 && (
        <div className="mb-8">
        <h2 className="mb-3 font-display text-lg font-bold text-rust">Needs attention</h2>
          <div className="overflow-x-auto rounded-lg border border-rust/30">
            <table className="w-full min-w-[440px] text-sm">
              <tbody>
                {overdue.map((inv) => (
                  <tr key={inv.id} className="border-b border-rule last:border-b-0 hover:bg-rust/5">
                    <td className="px-4 py-2.5">
                      <Link href={`/invoices/${inv.id}`} className="font-mono font-medium text-ink hover:text-rust">
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{inv.client?.name}</td>
                    <td className="px-4 py-2.5 text-ink-soft">due {formatDate(inv.dueDate)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-rust">
                      {money(inv.computed.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-navy">Recent invoices</h2>
          <Link href="/invoices" className="font-mono text-xs uppercase tracking-wide text-forest hover:underline">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto rounded-lg border border-rule">
          <table className="w-full min-w-[440px] text-sm">
            <tbody>
              {recent.map((inv) => (
                <tr key={inv.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/invoices/${inv.id}`} className="font-mono font-medium text-ink hover:text-forest">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{inv.client?.name}</td>
                  <td className="hidden px-4 py-2.5 text-ink-soft md:table-cell">{formatDate(inv.issueDate)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{money(inv.computed.total)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <StatusStamp status={inv.computed.effectiveStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
