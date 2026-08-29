import { db } from "@/db";
import { clients, catalogItems, creditNotes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { updateCreditNote } from "@/lib/actions/creditNotes";
import { getSettings } from "@/lib/numbering";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";
import LineItemsEditor from "@/components/LineItemsEditor";

export const dynamic = "force-dynamic";

export default async function EditCreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const creditNoteId = Number(id);

  const cn = await db.query.creditNotes.findFirst({
    where: eq(creditNotes.id, creditNoteId),
    with: { items: true },
  });
  if (!cn) notFound();

  const allClients = await db.select().from(clients).orderBy(clients.name);
  const settings = await getSettings();
  const catalog = await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.name);
  const save = updateCreditNote.bind(null, creditNoteId);

  const initialItems = cn.items.map((it) => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice }));

  return (
    <div>
      <PageHeader eyebrow="Accounts receivable" title={`Edit ${cn.number}`} />
      <Card className="max-w-3xl">
        <form action={save} className="space-y-5">
          <input type="hidden" name="invoiceId" value={cn.invoiceId ?? ""} />
          <div className="grid grid-cols-3 gap-4">
            <Field label="Client">
              <select name="clientId" required defaultValue={String(cn.clientId)} className={inputClass}>
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
            <Field label="Issue date">
              <input type="date" name="issueDate" defaultValue={cn.issueDate} required className={inputClass} />
            </Field>
            <Field label="Payment terms">
              <input name="paymentTerms" defaultValue={cn.paymentTerms ?? ""} className={inputClass} placeholder="e.g. Net 14 days" />
            </Field>
          </div>

          <LineItemsEditor
            initialItems={initialItems}
            initialTaxRate={cn.taxRate}
            initialDiscount={cn.discount}
            catalogItems={catalog}
            currency={settings.currency}
          />

          <Field label="Notes (shown on PDF)">
            <textarea name="notes" rows={3} className={inputClass} defaultValue={cn.notes ?? ""} placeholder="Reason for credit…" />
          </Field>

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Save changes</PrimaryButton>
            <GhostLink href={`/credit-notes/${creditNoteId}`}>Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}