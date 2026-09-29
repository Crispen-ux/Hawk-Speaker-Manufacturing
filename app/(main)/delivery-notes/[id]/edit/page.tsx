import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { clients, deliveryNotes, invoices } from "@/db/schema";
import { updateDeliveryNote } from "@/lib/actions/deliveryNotes";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";
import DeliveryItemsEditor from "@/components/DeliveryItemsEditor";

export const dynamic = "force-dynamic";

export default async function EditDeliveryNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dnId = Number(id);

  const dn = await db.query.deliveryNotes.findFirst({
    where: eq(deliveryNotes.id, dnId),
    with: { items: true },
  });
  if (!dn) notFound();

  const allClients = await db.select().from(clients).orderBy(clients.name);
  const recentInvoices = await db.query.invoices.findMany({
    with: { client: true },
    orderBy: (invoices, { desc }) => [desc(invoices.createdAt)],
    limit: 50,
  });
  const updateWithId = updateDeliveryNote.bind(null, dnId);

  return (
    <div>
      <PageHeader eyebrow="Logistics" title={`Edit ${dn.number}`} />
      <Card className="max-w-3xl">
        <form action={updateWithId} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Client">
              <select name="clientId" required defaultValue={dn.clientId} className={inputClass}>
                {allClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Delivery date">
              <input type="date" name="deliveryDate" defaultValue={dn.deliveryDate} required className={inputClass} />
            </Field>
            <Field label="Related invoice (optional)">
              <select name="relatedInvoiceId" defaultValue={dn.relatedInvoiceId ?? ""} className={inputClass}>
                <option value="">None</option>
                {recentInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} — {inv.client?.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <DeliveryItemsEditor
            initialItems={dn.items.map((it) => ({ description: it.description, quantity: it.quantity }))}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Delivered by">
              <input name="deliveredBy" defaultValue={dn.deliveredBy ?? ""} className={inputClass} />
            </Field>
            <Field label="Received by">
              <input name="receivedBy" defaultValue={dn.receivedBy ?? ""} className={inputClass} />
            </Field>
          </div>

          <Field label="Notes">
            <textarea name="notes" defaultValue={dn.notes ?? ""} rows={3} className={inputClass} />
          </Field>

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Save changes</PrimaryButton>
            <GhostLink href={`/delivery-notes/${dn.id}`}>Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
