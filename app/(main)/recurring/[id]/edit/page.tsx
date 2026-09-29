import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { clients, recurringInvoices, catalogItems } from "@/db/schema";
import { updateRecurring } from "@/lib/actions/recurring";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";
import LineItemsEditor from "@/components/LineItemsEditor";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export default async function EditRecurringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recurringId = Number(id);

  const rec = await db.query.recurringInvoices.findFirst({
    where: eq(recurringInvoices.id, recurringId),
    with: { items: true },
  });
  if (!rec) notFound();

  const allClients = await db.select().from(clients).orderBy(clients.name);
  const catalog = await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.name);
  const settings = await getSettings();
  const updateWithId = updateRecurring.bind(null, recurringId);

  return (
    <div>
      <PageHeader eyebrow="Recurring income" title="Edit recurring invoice" />
      <Card className="max-w-3xl">
        <form action={updateWithId} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Client">
              <select name="clientId" required defaultValue={rec.clientId} className={inputClass}>
                {allClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Frequency">
              <select name="frequency" defaultValue={rec.frequency} className={inputClass}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </Field>
            <Field label="Due (days after issue)">
              <input type="number" name="dueInDays" defaultValue={rec.dueInDays} min={0} className={inputClass} />
            </Field>
          </div>

          <Field label="Next invoice date">
            <input
              type="date"
              name="nextRunDate"
              defaultValue={rec.nextRunDate}
              required
              className={`${inputClass} max-w-xs`}
            />
          </Field>

          <LineItemsEditor
            initialItems={rec.items.map((it) => ({
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
            }))}
            initialTaxRate={rec.taxRate}
            initialDiscount={rec.discount}
            catalogItems={catalog}
            currency={settings.currency}
          />

          <Field label="Notes (shown on each generated invoice)">
            <textarea name="notes" defaultValue={rec.notes ?? ""} rows={3} className={inputClass} />
          </Field>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="autoSend" defaultChecked={rec.autoSend} className="h-4 w-4 rounded border-rule-strong" />
            Automatically email this invoice to the client when it's generated
          </label>

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Save changes</PrimaryButton>
            <GhostLink href={`/recurring/${rec.id}`}>Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
