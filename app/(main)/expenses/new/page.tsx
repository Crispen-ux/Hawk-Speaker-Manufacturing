import { createExpense } from "@/lib/actions/expenses";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { getSettings } from "@/lib/numbering";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const settings = await getSettings();
  const supplierRows = await db.select().from(suppliers).orderBy(suppliers.name);

  return (
    <div>
      <PageHeader eyebrow="Money out" title="Record expense" />
      <Card className="max-w-2xl">
        <form action={createExpense} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Description">
              <input name="description" required className={inputClass} placeholder="e.g. Diesel fill – bakkie" />
            </Field>
            <Field label={`Amount (${settings.currency || "R"})`}>
              <input name="amount" inputMode="decimal" defaultValue="0" className={inputClass} />
            </Field>
            <Field label="Date">
              <input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
            </Field>
            <Field label="Category">
              <input name="category" className={inputClass} placeholder="e.g. Materials, Fuel, Rent, Wages" />
            </Field>
            <Field label="Supplier">
              <select name="supplierId" className={inputClass}>
                <option value="">— None —</option>
                {supplierRows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Payment method">
              <select name="paymentMethod" className={inputClass}>
                <option value="">— None —</option>
                {["Cash", "EFT", "Card", "Fuel card", "Other"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reference (receipt / txn no.)">
              <input name="reference" className={inputClass} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea name="notes" rows={3} className={inputClass} />
          </Field>
          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Record expense</PrimaryButton>
            <GhostLink href="/expenses">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}