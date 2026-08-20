import { db } from "@/db";
import Link from "next/link";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import { formatDate, formatMoney } from "@/lib/money";
import { calcTotals } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const rows = await db.query.purchaseOrders.findMany({
    with: { supplier: true, items: true },
    orderBy: (purchaseOrders, { desc }) => [desc(purchaseOrders.createdAt)],
  });

  const computed = rows.map((r) => ({ ...r, totals: calcTotals(r.items, r.taxRate, r.discount) }));
  const filtered = status ? computed.filter((r) => r.status === status) : computed;
  const filters = ["all", "draft", "sent", "confirmed", "received", "cancelled"];

  return (
    <div>
      <PageHeader
        eyebrow="Procurement"
        title="Purchase orders"
        action={<LinkButton href="/purchase-orders/new">+ New purchase order</LinkButton>}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/purchase-orders" : `/purchase-orders?status=${f}`}
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
          title="No purchase orders here"
          hint="Raise a purchase order to order stock or services from a supplier."
          action={<LinkButton href="/purchase-orders/new">Create a purchase order</LinkButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Supplier</th>
                <th className="px-4 py-2.5 font-medium">Issued</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((po) => (
                <tr key={po.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="px-4 py-3">
                    <Link href={`/purchase-orders/${po.id}`} className="font-mono font-medium text-ink hover:text-forest">
                      {po.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{po.supplier?.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(po.issueDate)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatMoney(po.totals.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <StatusStamp status={po.status} />
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
