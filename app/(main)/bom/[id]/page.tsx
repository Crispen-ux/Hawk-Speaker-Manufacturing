import { db } from "@/db";
import { bomHeaders, bomItems, jobCards, supplierBills, supplierBillItems } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader, GhostLink, Card, EmptyState } from "@/components/ui";
import ConfirmForm from "@/components/ConfirmForm";
import { deleteBom } from "@/lib/actions/bom";
import { getSettings } from "@/lib/numbering";
import { formatMoney, formatDate } from "@/lib/money";

export const dynamic = "force-dynamic";

const VAT_LABELS: Record<string, string> = {
  standard: "Std",
  zero_rated: "0%",
  exempt: "Exempt",
};

export default async function BomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bomId = Number(id);
  const [header] = await db.select().from(bomHeaders).where(eq(bomHeaders.id, bomId));
  if (!header) notFound();

  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");
  const items = await db
    .select()
    .from(bomItems)
    .where(eq(bomItems.bomId, bomId))
    .orderBy(bomItems.sortOrder);

  const linkedJobCards = await db.select().from(jobCards).where(eq(jobCards.bomId, bomId));

  // Supplier bills that reference any of this BOM's components.
  const bomItemIds = items.map((it) => it.id);
  let linkedSupplierBills: typeof supplierBills.$inferSelect[] = [];
  if (bomItemIds.length > 0) {
    const sbItems = await db
      .select({ supplierBillId: supplierBillItems.supplierBillId, bomItemId: supplierBillItems.bomItemId })
      .from(supplierBillItems)
      .where(inArray(supplierBillItems.bomItemId, bomItemIds));
    const sbIds = Array.from(new Set(sbItems.map((s) => s.supplierBillId)));
    linkedSupplierBills = sbIds.length
      ? await db
          .select()
          .from(supplierBills)
          .where(inArray(supplierBills.id, sbIds))
      : [];
  }

  const totalCost = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitCost) * (1 + Number(it.markup) / 100), 0);
  const remove = deleteBom.bind(null, bomId);

  return (
    <div>
      <PageHeader
        eyebrow="Production"
        title={header.name}
        action={
          <div className="flex items-center gap-2">
            <GhostLink href={`/api/bom/pdf/${bomId}`}>Download PDF</GhostLink>
            <GhostLink href={`/bom/${bomId}/edit`}>Edit</GhostLink>
          </div>
        }
      />

      {header.description && <p className="mb-6 -mt-3 max-w-2xl text-sm text-ink-soft">{header.description}</p>}

      <Card className="max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            {items.length} component{items.length === 1 ? "" : "s"}
          </div>
          <div className="text-lg font-semibold">
            Total <span className="font-mono">{money(totalCost)}</span>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState title="No components" hint="Add components to describe what this BOM is made of." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-rule">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                  <th className="px-4 py-2.5 font-medium">Component</th>
                  <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-4 py-2.5 text-right font-medium">Unit cost</th>
                  <th className="px-4 py-2.5 text-right font-medium">Markup</th>
                  <th className="px-4 py-2.5 font-medium">VAT</th>
                  <th className="px-4 py-2.5 text-right font-medium">Line total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-rule last:border-b-0">
                    <td className="px-4 py-3">{it.description}</td>
                    <td className="px-4 py-3 text-right font-mono">{Number(it.quantity)}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(it.unitCost)}</td>
                    <td className="px-4 py-3 text-right font-mono">{Number(it.markup)}%</td>
                    <td className="px-4 py-3 text-xs text-ink-soft">{VAT_LABELS[it.vatTreatment] ?? it.vatTreatment}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(Number(it.quantity) * Number(it.unitCost) * (1 + Number(it.markup) / 100))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {linkedJobCards.length > 0 && (
        <Card className="mt-6 max-w-4xl">
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">Used on job cards</h3>
          <ul className="space-y-1">
            {linkedJobCards.map((j) => (
              <li key={j.id}>
                <Link href={`/job-cards/${j.id}`} className="text-sm text-forest hover:underline">
                  {j.title || `Job #${j.id}`}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {linkedSupplierBills.length > 0 && (
        <Card className="mt-6 max-w-4xl">
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">Supplier bills for these components</h3>
          <ul className="space-y-1">
            {linkedSupplierBills.map((b) => (
              <li key={b.id} className="flex items-center justify-between">
                <Link href={`/supplier-bills/${b.id}`} className="font-mono text-sm text-forest hover:underline">
                  {b.number}
                </Link>
                <span className="font-mono text-xs text-ink-soft">{formatDate(b.billDate)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6">
        <ConfirmForm action={remove} confirm="Delete this BOM? Job cards already referencing it will keep their own details.">
          <button type="submit" className="font-mono text-xs uppercase tracking-wide text-rust hover:underline">
            Delete BOM
          </button>
        </ConfirmForm>
      </div>
    </div>
  );
}
