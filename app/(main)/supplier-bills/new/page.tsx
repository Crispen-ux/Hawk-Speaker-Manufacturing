import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { getSettings } from "@/lib/numbering";
import { createSupplierBill } from "@/lib/actions/supplier-bills";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";
import SupplierBillItemsEditor from "@/components/SupplierBillItemsEditor";

export const dynamic = "force-dynamic";

export default async function NewSupplierBillPage() {
  const settings = await getSettings();
  const supplierRows = await db.select().from(suppliers).orderBy(suppliers.name);

  return (
    <div>
      <PageHeader eyebrow="Purchasing" title="New supplier bill" />
      <Card className="max-w-3xl">
        <form action={createSupplierBill} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Supplier">
              <select name="supplierId" required className={inputClass}>
                <option value="" disabled>Select supplier…</option>
                {supplierRows.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <input name="description" required className={inputClass} placeholder="AC parts from supplier" />
            </Field>
            <Field label="Bill date">
              <input type="date" name="billDate" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
            </Field>
            <Field label="Due date (optional)">
              <input type="date" name="dueDate" className={inputClass} />
            </Field>
            <Field label="Tax rate %">
              <input name="taxRate" defaultValue={settings.defaultTaxRate} inputMode="decimal" className={`${inputClass} font-mono`} />
            </Field>
            <Field label="Discount">
              <input name="discount" defaultValue="0" inputMode="decimal" className={`${inputClass} font-mono`} />
            </Field>
          </div>

          <Field label="Notes">
            <textarea name="notes" rows={2} className={inputClass} />
          </Field>

          <SupplierBillItemsEditor initialItems={[]} currency={settings.currency} />

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Create supplier bill</PrimaryButton>
            <GhostLink href="/supplier-bills">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
