import Link from "next/link";
import { db } from "@/db";
import { catalogItems, inventoryMovements } from "@/db/schema";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import { formatDate, formatMoney, toNumber } from "@/lib/money";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const [items, movements] = await Promise.all([
    db.select().from(catalogItems).orderBy(catalogItems.name),
    db.select().from(inventoryMovements).orderBy(inventoryMovements.createdAt),
  ]);

  const stock = new Map<number, number>();
  const lastDate = new Map<number, string>();
  for (const m of movements) {
    stock.set(m.catalogItemId, (stock.get(m.catalogItemId) ?? 0) + toNumber(m.deltaQty));
    lastDate.set(m.catalogItemId, m.createdAt?.toISOString?.() ?? "");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Stock"
        title="Inventory"
        action={<LinkButton href="/inventory/movements/new">+ Record movement</LinkButton>}
      />

      {items.length === 0 ? (
        <EmptyState
          title="No products yet"
          hint="Stock is tracked against items in the catalogue. Add products first, then record movements."
          action={<LinkButton href="/catalog/new">Add a product</LinkButton>}
        />
      ) : items.every((i) => (stock.get(i.id) ?? 0) === 0) && movements.length === 0 ? (
        <EmptyState
          title="No movements yet"
          hint="Record stock coming in (purchases) or going out (sales, write-offs) to build your balance."
          action={<LinkButton href="/inventory/movements/new">Record a movement</LinkButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">Unit</th>
                <th className="px-4 py-2.5 text-right font-medium">On hand</th>
                <th className="px-4 py-2.5 text-right font-medium">Unit price</th>
                <th className="px-4 py-2.5 text-right font-medium">Stock value</th>
                <th className="px-4 py-2.5 font-medium">Last movement</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const onHand = stock.get(i.id) ?? 0;
                return (
                  <tr key={i.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                    <td className="px-4 py-3">
                      <Link href={`/catalog/${i.id}`} className="font-medium text-ink hover:text-forest">
                        {i.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{i.unit || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={onHand < 0 ? "text-rust" : onHand === 0 ? "text-ink-soft" : "text-ink"}>
                        {onHand}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{money(i.unitPrice)}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(onHand * toNumber(i.unitPrice))}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {lastDate.get(i.id) ? formatDate(lastDate.get(i.id) as string) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-10 mb-3 font-display text-lg font-bold text-navy">
        Movement history ({movements.length})
      </h2>
      <p className="mb-3 text-xs text-ink-soft">
        <Link href="/inventory/movements" className="text-forest hover:underline">
          Open full movement log
        </Link>
      </p>
    </div>
  );
}