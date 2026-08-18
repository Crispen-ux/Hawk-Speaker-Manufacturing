import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { clients, invoices, catalogItems } from "@/db/schema";
import { updateInvoice } from "@/lib/actions/invoices";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";
import LineItemsEditor from "@/components/LineItemsEditor";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = Number(id);

  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, invoiceId),
    with: { items: true },
  });
  if (!invoice) notFound();

  const allClients = await db.select().from(clients).orderBy(clients.name);
  const catalog = await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.name);
  const updateWithId = updateInvoice.bind(null, invoiceId);

  return (
    <div>
      <PageHeader eyebrow="Accounts receivable" title={`Edit ${invoice.number}`} />
      <Card className="max-w-3xl">
        <form action={updateWithId} className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Client">
              <select name="clientId" required defaultValue={invoice.clientId} className={inputClass}>
                {allClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Issue date">
              <input type="date" name="issueDate" defaultValue={invoice.issueDate} required className={inputClass} />
            </Field>
            <Field label="Due date">
              <input type="date" name="dueDate" defaultValue={invoice.dueDate} required className={inputClass} />
            </Field>
          </div>

          <LineItemsEditor
            initialItems={invoice.items.map((it) => ({
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
            }))}
            initialTaxRate={invoice.taxRate}
            initialDiscount={invoice.discount}
            catalogItems={catalog}
          />

          <Field label="Notes (shown on PDF)">
            <textarea name="notes" defaultValue={invoice.notes ?? ""} rows={3} className={inputClass} />
          </Field>

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Save changes</PrimaryButton>
            <GhostLink href={`/invoices/${invoice.id}`}>Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
