import Link from "next/link";
import { db } from "@/db";
import { inventoryMovements } from "@/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/money";
import { deleteMovement } from "@/lib/actions/inventory";

export const dynamic = "force-dynamic";

export default async function InventoryMovementsPage() {
  const rows = await db.query.inventoryMovements.findMany({
    with: { item: true },
    orderBy: desc(inventoryMovements.createdAt),
    limit: 300,
  });

  return (
    <div>
      <PageHeader
        eyebrow="Stock"
        title="Movement log"
        action={<LinkButton href="/inventory/movements/new">+ Record movement</LinkButton>}
      />

      {rows.length === 0 ? (
        <EmptyState title="No movements" hint="Every stock in/out is logged here." action={<LinkButton href="/inventory/movements/new">Record a movement</LinkButton>} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">Reason</th>
                <th className="px-4 py-2.5 font-medium">Reference</th>
                <th className="px-4 py-2.5 text-right font-medium">Delta</th>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const remove = deleteMovement.bind(null, m.id);
                const delta = Number(m.deltaQty);
                return (
                  <tr key={m.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                    <td className="px-4 py-3">
                      <Link href={`/catalog/${m.catalogItemId}`} className="font-medium text-ink hover:text-forest">
                        {m.item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{m.reason.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">{m.reference || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={delta >= 0 ? "text-success" : "text-rust"}>
                        {delta >= 0 ? "+" : ""}
                        {delta}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{formatDate((m.createdAt as Date).toISOString())}</td>
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
    </div>
  );
}