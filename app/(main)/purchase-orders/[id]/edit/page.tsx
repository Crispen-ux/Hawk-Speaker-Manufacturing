import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { suppliers, purchaseOrders, catalogItems } from "@/db/schema";
import { updatePurchaseOrder } from "@/lib/actions/purchaseOrders";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";
import LineItemsEditor from "@/components/LineItemsEditor";

export const dynamic = "force-dynamic";

export default async function EditPurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const poId = Number(id);

  const po = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, poId),
    with: { items: true },
  });
  if (!po) notFound();

  const allSuppliers = await db.select().from(suppliers).orderBy(suppliers.name);
  const catalog = await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.name);
  const updateWithId = updatePurchaseOrder.bind(null, poId);

  return (
    <div>
      <PageHeader eyebrow="Procurement" title={`Edit ${po.number}`} />
      <Card className="max-w-3xl">
        <form action={updateWithId} className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Supplier">
              <select name="supplierId" required defaultValue={po.supplierId} className={inputClass}>
                {allSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Issue date">
              <input type="date" name="issueDate" defaultValue={po.issueDate} required className={inputClass} />
            </Field>
            <Field label="Expected delivery">
              <input type="date" name="expectedDate" defaultValue={po.expectedDate ?? ""} className={inputClass} />
            </Field>
          </div>

          <LineItemsEditor
            initialItems={po.items.map((it) => ({
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
            }))}
            initialTaxRate={po.taxRate}
            initialDiscount={po.discount}
            catalogItems={catalog}
          />

          <Field label="Notes (shown on PDF)">
            <textarea name="notes" defaultValue={po.notes ?? ""} rows={3} className={inputClass} />
          </Field>

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Save changes</PrimaryButton>
            <GhostLink href={`/purchase-orders/${po.id}`}>Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
