import { db } from "@/db";
import { suppliers, supplierBills, supplierBillItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/numbering";
import { updateSupplierBill } from "@/lib/actions/supplier-bills";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";
import SupplierBillItemsEditor, { type SupplierBillItem } from "@/components/SupplierBillItemsEditor";

export const dynamic = "force-dynamic";

export default async function EditSupplierBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const billId = Number(id);
  const settings = await getSettings();

  const [bill] = await db.select().from(supplierBills).where(eq(supplierBills.id, billId));
  if (!bill) notFound();

  const supplierRows = await db.select().from(suppliers).orderBy(suppliers.name);
  const rows = await db.select().from(supplierBillItems).where(eq(supplierBillItems.supplierBillId, billId)).orderBy(supplierBillItems.sortOrder);

  const initialItems: SupplierBillItem[] = rows.map((it) => ({
    description: it.description,
    quantity: it.quantity,
    unitCost: it.unitCost,
    vatTreatment: it.vatTreatment,
  }));

  const updateWithId = updateSupplierBill.bind(null, billId);

  return (
    <div>
      <PageHeader eyebrow="Purchasing" title={`Edit ${bill.number}`} />
      <Card className="max-w-3xl">
        <form action={updateWithId} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Supplier">
              <select name="supplierId" required defaultValue={bill.supplierId} className={inputClass}>
                {supplierRows.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <input name="description" required defaultValue={bill.description} className={inputClass} />
            </Field>
            <Field label="Bill date">
              <input type="date" name="billDate" required defaultValue={bill.billDate} className={inputClass} />
            </Field>
            <Field label="Due date (optional)">
              <input type="date" name="dueDate" defaultValue={bill.dueDate ?? ""} className={inputClass} />
            </Field>
            <Field label="Tax rate %">
              <input name="taxRate" defaultValue={bill.taxRate} inputMode="decimal" className={`${inputClass} font-mono`} />
            </Field>
            <Field label="Discount">
              <input name="discount" defaultValue={bill.discount} inputMode="decimal" className={`${inputClass} font-mono`} />
            </Field>
          </div>

          <Field label="Notes">
            <textarea name="notes" defaultValue={bill.notes ?? ""} rows={2} className={inputClass} />
          </Field>

          <SupplierBillItemsEditor initialItems={initialItems} currency={settings.currency} />

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Save changes</PrimaryButton>
            <GhostLink href={`/supplier-bills/${billId}`}>Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
