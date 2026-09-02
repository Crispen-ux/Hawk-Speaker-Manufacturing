import { db } from "@/db";
import { bomHeaders, bomItems } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export default async function BomPage() {
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");
  const headers = await db.query.bomHeaders.findMany({ orderBy: [desc(bomHeaders.createdAt)], with: { items: true } });

  function totalFor(header: { items: { quantity: string; unitCost: string; markup: string }[] }) {
    return header.items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitCost) * (1 + Number(it.markup) / 100), 0);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Production"
        title="Bill of materials"
        action={<LinkButton href="/bom/new">+ New BOM</LinkButton>}
      />

      {headers.length === 0 ? (
        <EmptyState
          title="No BOMs yet"
          hint="Define the components, spares and labour steps that make up a product or service — quantities, unit costs and markup — so they can feed quotations and job cards."
          action={<LinkButton href="/bom/new">Create your first BOM</LinkButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Components</th>
                <th className="px-4 py-2.5 text-right font-medium">Total cost</th>
              </tr>
            </thead>
            <tbody>
              {headers.map((h) => (
                <tr key={h.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="px-4 py-3">
                    <Link href={`/bom/${h.id}`} className="font-medium text-ink hover:text-forest">
                      {h.name}
                    </Link>
                    {h.description && <div className="mt-0.5 text-xs text-ink-soft">{h.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{h.items.length} line{h.items.length === 1 ? "" : "s"}</td>
                  <td className="px-4 py-3 text-right font-mono">{money(totalFor(h))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
