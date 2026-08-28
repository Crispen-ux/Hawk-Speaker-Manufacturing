import { db } from "@/db";
import { clients, catalogItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createRecurring } from "@/lib/actions/recurring";
import { getSettings } from "@/lib/numbering";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card, EmptyState, LinkButton } from "@/components/ui";
import LineItemsEditor from "@/components/LineItemsEditor";

export const dynamic = "force-dynamic";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function NewRecurringPage() {
  const allClients = await db.select().from(clients).orderBy(clients.name);
  const settings = await getSettings();
  const catalog = await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.name);

  if (allClients.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Recurring income" title="New recurring invoice" />
        <EmptyState
          title="No clients yet"
          hint="Add a client before setting up a recurring invoice for them."
          action={<LinkButton href="/clients/new">Add a client</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Recurring income" title="New recurring invoice" />
      <Card className="max-w-3xl">
        <form action={createRecurring} className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Client">
              <select name="clientId" required className={inputClass}>
                <option value="" disabled>
                  Select client…
                </option>
                {allClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Frequency">
              <select name="frequency" defaultValue="monthly" className={inputClass}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </Field>
            <Field label="Due (days after issue)">
              <input type="number" name="dueInDays" defaultValue={14} min={0} className={inputClass} />
            </Field>
          </div>

          <Field label="First invoice date">
            <input type="date" name="nextRunDate" defaultValue={todayISO()} required className={`${inputClass} max-w-xs`} />
          </Field>

          <LineItemsEditor
            initialItems={[]}
            initialTaxRate={settings.defaultTaxRate}
            initialDiscount="0"
            catalogItems={catalog}
            currency={settings.currency}
          />

          <Field label="Notes (shown on each generated invoice)">
            <textarea name="notes" rows={3} className={inputClass} placeholder="Payment terms, thank-you note…" />
          </Field>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="autoSend" className="h-4 w-4 rounded border-rule-strong" />
            Automatically email this invoice to the client when it's generated
          </label>

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Create recurring invoice</PrimaryButton>
            <GhostLink href="/recurring">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
