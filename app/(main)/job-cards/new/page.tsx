import { db } from "@/db";
import { clients, catalogItems, bomHeaders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createJobCard } from "@/lib/actions/jobCards";
import { getSettings } from "@/lib/numbering";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card, EmptyState, LinkButton } from "@/components/ui";
import LineItemsEditor from "@/components/LineItemsEditor";

export const dynamic = "force-dynamic";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function NewJobCardPage() {
  const allClients = await db.select().from(clients).orderBy(clients.name);
  const settings = await getSettings();
  const catalog = await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.name);
  const boms = await db.select().from(bomHeaders).orderBy(bomHeaders.name);

  if (allClients.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Field work" title="New job card" />
        <EmptyState
          title="No clients yet"
          hint="Add a client before opening a job card for them."
          action={<LinkButton href="/clients/new">Add a client</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Field work" title="New job card" />
      <Card className="max-w-3xl">
        <form action={createJobCard} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
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
            <Field label="Opened date">
              <input type="date" name="openedDate" defaultValue={todayISO()} required className={inputClass} />
            </Field>
          </div>

          <Field label="Job title">
            <input name="title" required className={inputClass} placeholder="Server room AC unit — no cooling" />
          </Field>

          <Field label="Description">
            <textarea name="description" rows={3} className={inputClass} placeholder="Fault reported, diagnosis, work carried out…" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Technician">
              <input name="technician" className={inputClass} placeholder="J. Moyo" />
            </Field>
            <Field label="Equipment / asset">
              <input name="equipment" className={inputClass} placeholder="Dell PowerEdge R740, Serial #123" />
            </Field>
          </div>

          {boms.length > 0 && (
            <Field label="Bill of materials (optional)">
              <select name="bomId" className={inputClass}>
                <option value="">None</option>
                {boms.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <LineItemsEditor
            initialItems={[]}
            initialTaxRate={settings.defaultTaxRate}
            initialDiscount="0"
            catalogItems={catalog}
            currency={settings.currency}
          />

          <Field label="Notes (carried onto the invoice if converted)">
            <textarea name="notes" rows={2} className={inputClass} />
          </Field>

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Create job card</PrimaryButton>
            <GhostLink href="/job-cards">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
