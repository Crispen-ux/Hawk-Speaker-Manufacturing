import { db } from "@/db";
import { catalogItems } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { toggleCatalogItemActive } from "@/lib/actions/catalog";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const rows = await db.select().from(catalogItems).orderBy(desc(catalogItems.createdAt));

  return (
    <div>
      <PageHeader
        eyebrow="Products &amp; services"
        title="Catalogue"
        action={<LinkButton href="/catalog/new">+ New item</LinkButton>}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No catalogue items yet"
          hint="Add the products or services you bill for regularly — hosting plans, packages, hourly rates — so you can drop them into invoices and quotations in one click."
          action={<LinkButton href="/catalog/new">Add your first item</LinkButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Unit</th>
                <th className="px-4 py-2.5 text-right font-medium">Price</th>
                <th className="px-4 py-2.5 text-right font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const toggle = toggleCatalogItemActive.bind(null, item.id, !item.active);
                return (
                  <tr key={item.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                    <td className="px-4 py-3">
                      <Link href={`/catalog/${item.id}`} className="font-medium text-ink hover:text-forest">
                        {item.name}
                      </Link>
                      {item.description && (
                        <div className="mt-0.5 text-xs text-ink-soft">{item.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{item.unit || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatMoney(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={toggle}>
                        <button
                          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                            item.active
                              ? "border-forest text-forest"
                              : "border-rule-strong text-ink-soft"
                          }`}
                        >
                          {item.active ? "active" : "hidden"}
                        </button>
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
