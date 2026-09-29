import { createExpense } from "@/lib/actions/expenses";
import { db } from "@/db";
import { suppliers, jobCards } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSettings } from "@/lib/numbering";
import { getExpenseAccounts } from "@/lib/ledger";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const settings = await getSettings();
  const supplierRows = await db.select().from(suppliers).orderBy(suppliers.name);
  const accountRows = await getExpenseAccounts();
  const openJobs = await db.select().from(jobCards).where(eq(jobCards.status, "open")).orderBy(jobCards.number);

  return (
    <div>
      <PageHeader eyebrow="Money out" title="Record expense" />
      <Card className="max-w-2xl">
        <form action={createExpense} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <Field label="Chart account">
              <select name="accountId" className={inputClass} defaultValue="">
                <option value="">— Auto (from category) —</option>
                {accountRows.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} {a.name}
                  </option>
                ))}
              </select>
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
            <Field label="VAT treatment">
              <select name="vatTreatment" defaultValue="standard" className={inputClass}>
                <option value="standard">Standard</option>
                <option value="zero_rated">Zero-rated</option>
                <option value="exempt">Exempt</option>
              </select>
            </Field>
            <Field label="Reference (receipt / txn no.)">
              <input name="reference" className={inputClass} />
            </Field>
            {openJobs.length > 0 && (
              <Field label="Job card (optional)">
                <select name="jobCardId" className={inputClass}>
                  <option value="">— None —</option>
                  {openJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.number} — {j.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}
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
