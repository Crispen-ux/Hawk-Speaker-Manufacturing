import { db } from "@/db";
import { suppliers, catalogItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createPurchaseOrder } from "@/lib/actions/purchaseOrders";
import { getSettings } from "@/lib/numbering";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card, EmptyState, LinkButton } from "@/components/ui";
import LineItemsEditor from "@/components/LineItemsEditor";

export const dynamic = "force-dynamic";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function NewPurchaseOrderPage() {
  const allSuppliers = await db.select().from(suppliers).orderBy(suppliers.name);
  const settings = await getSettings();
  const catalog = await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.name);

  if (allSuppliers.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Procurement" title="New purchase order" />
        <EmptyState
          title="No suppliers yet"
          hint="Add a supplier before you can raise a purchase order against them."
          action={<LinkButton href="/suppliers/new">Add a supplier</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Procurement" title="New purchase order" />
      <Card className="max-w-3xl">
        <form action={createPurchaseOrder} className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Supplier">
              <select name="supplierId" required className={inputClass}>
                <option value="" disabled>
                  Select supplier…
                </option>
                {allSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Issue date">
              <input type="date" name="issueDate" defaultValue={todayISO()} required className={inputClass} />
            </Field>
            <Field label="Expected delivery">
              <input type="date" name="expectedDate" defaultValue={plusDaysISO(7)} className={inputClass} />
            </Field>
          </div>

          <LineItemsEditor
            initialItems={[]}
            initialTaxRate={settings.defaultTaxRate}
            initialDiscount="0"
            catalogItems={catalog}
            currency={settings.currency}
          />

          <Field label="Notes (shown on PDF)">
            <textarea name="notes" rows={3} className={inputClass} placeholder="Delivery instructions, terms…" />
          </Field>

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Create purchase order</PrimaryButton>
            <GhostLink href="/purchase-orders">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
