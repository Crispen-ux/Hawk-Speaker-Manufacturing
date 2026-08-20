import { db } from "@/db";
import { clients } from "@/db/schema";
import { createDeliveryNote } from "@/lib/actions/deliveryNotes";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card, EmptyState, LinkButton } from "@/components/ui";
import DeliveryItemsEditor from "@/components/DeliveryItemsEditor";

export const dynamic = "force-dynamic";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function NewDeliveryNotePage() {
  const allClients = await db.select().from(clients).orderBy(clients.name);
  const recentInvoices = await db.query.invoices.findMany({
    with: { client: true },
    orderBy: (invoices, { desc }) => [desc(invoices.createdAt)],
    limit: 50,
  });

  if (allClients.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Logistics" title="New delivery note" />
        <EmptyState
          title="No clients yet"
          hint="Add a client before recording a delivery to them."
          action={<LinkButton href="/clients/new">Add a client</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Logistics" title="New delivery note" />
      <Card className="max-w-3xl">
        <form action={createDeliveryNote} className="space-y-5">
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
            <Field label="Delivery date">
              <input type="date" name="deliveryDate" defaultValue={todayISO()} required className={inputClass} />
            </Field>
            <Field label="Related invoice (optional)">
              <select name="relatedInvoiceId" defaultValue="" className={inputClass}>
                <option value="">None</option>
                {recentInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} — {inv.client?.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <DeliveryItemsEditor initialItems={[]} />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Delivered by">
              <input name="deliveredBy" className={inputClass} placeholder="Driver / technician name" />
            </Field>
            <Field label="Received by">
              <input name="receivedBy" className={inputClass} placeholder="Client contact name" />
            </Field>
          </div>

          <Field label="Notes">
            <textarea name="notes" rows={3} className={inputClass} placeholder="Delivery instructions, condition on arrival…" />
          </Field>

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Create delivery note</PrimaryButton>
            <GhostLink href="/delivery-notes">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
