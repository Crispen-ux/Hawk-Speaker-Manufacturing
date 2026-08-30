import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { expenses, suppliers } from "@/db/schema";
import { updateExpense } from "@/lib/actions/expenses";
import { getSettings } from "@/lib/numbering";
import { getExpenseAccounts } from "@/lib/ledger";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const expenseId = Number(id);
  const settings = await getSettings();
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId));
  if (!expense) notFound();
  const supplierRows = await db.select().from(suppliers).orderBy(suppliers.name);
  const accountRows = await getExpenseAccounts();
  const update = updateExpense.bind(null, expenseId);

  return (
    <div>
      <PageHeader eyebrow="Money out" title="Edit expense" />
      <Card className="max-w-2xl">
        <form action={update} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Description">
              <input name="description" required defaultValue={expense.description} className={inputClass} />
            </Field>
            <Field label={`Amount (${settings.currency || "R"})`}>
              <input name="amount" inputMode="decimal" defaultValue={expense.amount} className={inputClass} />
            </Field>
            <Field label="Date">
              <input type="date" name="date" required defaultValue={expense.date} className={inputClass} />
            </Field>
            <Field label="Category">
              <input name="category" defaultValue={expense.category ?? ""} className={inputClass} />
            </Field>
            <Field label="Chart account">
              <select name="accountId" defaultValue={expense.accountId ?? ""} className={inputClass}>
                <option value="">— Auto (from category) —</option>
                {accountRows.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Supplier">
              <select name="supplierId" defaultValue={expense.supplierId ?? ""} className={inputClass}>
                <option value="">— None —</option>
                {supplierRows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Payment method">
              <select name="paymentMethod" defaultValue={expense.paymentMethod ?? ""} className={inputClass}>
                <option value="">— None —</option>
                {["Cash", "EFT", "Card", "Fuel card", "Other"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reference (receipt / txn no.)">
              <input name="reference" defaultValue={expense.reference ?? ""} className={inputClass} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea name="notes" rows={3} defaultValue={expense.notes ?? ""} className={inputClass} />
          </Field>
          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Save changes</PrimaryButton>
            <GhostLink href={`/expenses/${expenseId}`}>Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}