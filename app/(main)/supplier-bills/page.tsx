import { db } from "@/db";
import { supplierBills } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import StatusStamp from "@/components/StatusStamp";

export const dynamic = "force-dynamic";

export default async function SupplierBillsPage() {
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");
  const bills = await db.query.supplierBills.findMany({
    orderBy: [desc(supplierBills.createdAt)],
    with: { supplier: true, items: true },
  });

  function totalFor(bill: { items: { quantity: string; unitCost: string }[] }) {
    return bill.items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitCost), 0);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Purchasing"
        title="Supplier bills"
        action={<LinkButton href="/supplier-bills/new">+ New supplier bill</LinkButton>}
      />

      {bills.length === 0 ? (
        <EmptyState
          title="No supplier bills yet"
          hint="Record bills from your suppliers — parts, services, materials — to track what you owe and link costs to jobs."
          action={<LinkButton href="/supplier-bills/new">Add your first bill</LinkButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Supplier</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="px-4 py-3">
                    <Link href={`/supplier-bills/${b.id}`} className="font-mono text-sm font-medium text-forest hover:underline">
                      {b.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{b.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{b.description}</td>
                  <td className="px-4 py-3">
                    <StatusStamp status={b.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{money(totalFor(b))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
