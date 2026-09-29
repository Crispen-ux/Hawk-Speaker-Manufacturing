import { db } from "@/db";
import { clients, catalogItems, invoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createCreditNote } from "@/lib/actions/creditNotes";
import { getSettings } from "@/lib/numbering";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card, EmptyState, LinkButton } from "@/components/ui";
import LineItemsEditor from "@/components/LineItemsEditor";

export const dynamic = "force-dynamic";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function NewCreditNotePage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string }>;
}) {
  const { invoice: invoiceParam } = await searchParams;
  const invoiceId = invoiceParam ? Number(invoiceParam) : null;

  const allClients = await db.select().from(clients).orderBy(clients.name);
  const settings = await getSettings();
  const catalog = await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.name);

  const invoice =
    invoiceId && Number.isFinite(invoiceId)
      ? await db.query.invoices.findFirst({
          where: eq(invoices.id, invoiceId),
          with: { items: true },
        })
      : null;

  if (allClients.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Accounts receivable" title="New credit note" />
        <EmptyState
          title="No clients yet"
          hint="Add a client before you can issue a credit note against them."
          action={<LinkButton href="/clients/new">Add a client</LinkButton>}
        />
      </div>
    );
  }

  const initialItems = invoice ? invoice.items.map((it) => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice })) : [];
  const defaultClient = invoice ? String(invoice.clientId) : "";

  return (
    <div>
      <PageHeader
        eyebrow="Accounts receivable"
        title="New credit note"
      />
      <Card className="max-w-3xl">
        <form action={createCreditNote} className="space-y-5">
          <input type="hidden" name="invoiceId" value={invoice ? String(invoice.id) : ""} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Client">
              <select name="clientId" required defaultValue={defaultClient} className={inputClass}>
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
              <input type="date" name="issueDate" defaultValue={todayISO()} required className={inputClass} />
            </Field>
            <Field label="Payment terms">
              <input
                name="paymentTerms"
                defaultValue={settings.paymentTermsDays ? `Net ${settings.paymentTermsDays} days` : ""}
                className={inputClass}
                placeholder="e.g. Net 14 days"
              />
            </Field>
          </div>

          <LineItemsEditor
            initialItems={initialItems}
            initialTaxRate={invoice?.taxRate ?? settings.defaultTaxRate}
            initialDiscount={invoice?.discount ?? "0"}
            catalogItems={catalog}
            currency={settings.currency}
          />

          <Field label="Notes (shown on PDF)">
            <textarea name="notes" rows={3} className={inputClass} placeholder="Reason for credit…" />
          </Field>

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Create credit note</PrimaryButton>
            <GhostLink href={invoice ? `/invoices/${invoice.id}` : "/credit-notes"}>Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}