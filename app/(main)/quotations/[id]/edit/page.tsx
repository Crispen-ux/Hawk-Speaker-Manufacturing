import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { clients, quotations, catalogItems } from "@/db/schema";
import { updateQuotation } from "@/lib/actions/quotations";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";
import LineItemsEditor from "@/components/LineItemsEditor";

export const dynamic = "force-dynamic";

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quotationId = Number(id);

  const quotation = await db.query.quotations.findFirst({
    where: eq(quotations.id, quotationId),
    with: { items: true },
  });
  if (!quotation) notFound();

  const allClients = await db.select().from(clients).orderBy(clients.name);
  const catalog = await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.name);
  const updateWithId = updateQuotation.bind(null, quotationId);

  return (
    <div>
      <PageHeader eyebrow="Proposals" title={`Edit ${quotation.number}`} />
      <Card className="max-w-3xl">
        <form action={updateWithId} className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Client">
              <select name="clientId" required defaultValue={quotation.clientId} className={inputClass}>
                {allClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Issue date">
              <input type="date" name="issueDate" defaultValue={quotation.issueDate} required className={inputClass} />
            </Field>
            <Field label="Valid until">
              <input type="date" name="expiryDate" defaultValue={quotation.expiryDate} required className={inputClass} />
            </Field>
          </div>

          <LineItemsEditor
            initialItems={quotation.items.map((it) => ({
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
            }))}
            initialTaxRate={quotation.taxRate}
            initialDiscount={quotation.discount}
            catalogItems={catalog}
          />

          <Field label="Notes (shown on PDF)">
            <textarea name="notes" defaultValue={quotation.notes ?? ""} rows={3} className={inputClass} />
          </Field>

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Save changes</PrimaryButton>
            <GhostLink href={`/quotations/${quotation.id}`}>Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
