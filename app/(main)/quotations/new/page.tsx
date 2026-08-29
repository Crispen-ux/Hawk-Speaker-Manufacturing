import { db } from "@/db";
import { clients, catalogItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createQuotation } from "@/lib/actions/quotations";
import { getSettings } from "@/lib/numbering";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card, EmptyState, LinkButton } from "@/components/ui";
import LineItemsEditor from "@/components/LineItemsEditor";

export const dynamic = "force-dynamic";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const allClients = await db.select().from(clients).orderBy(clients.name);
  const settings = await getSettings();
  const catalog = await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.name);

  if (allClients.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Proposals" title="New quotation" />
        <EmptyState
          title="No clients yet"
          hint="Add a client before you can prepare a quotation for them."
          action={<LinkButton href="/clients/new">Add a client</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Proposals" title="New quotation" />
      <Card className="max-w-3xl">
        <form action={createQuotation} className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Client">
              <select name="clientId" required defaultValue={client ?? ""} className={inputClass}>
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
            <Field label="Valid until">
              <input type="date" name="expiryDate" defaultValue={plusDaysISO(30)} required className={inputClass} />
            </Field>
          </div>

          <LineItemsEditor
            initialItems={[]}
            initialTaxRate={settings.defaultTaxRate}
            initialDiscount="0"
            catalogItems={catalog}
            currency={settings.currency}
          />

          <Field label="Payment terms (shown on PDF)">
            <input
              name="paymentTerms"
              className={inputClass}
              defaultValue={`Net ${settings.paymentTermsDays ?? 14} days`}
              placeholder="e.g. Net 14 days"
            />
          </Field>

          <Field label="Notes (shown on PDF)">
            <textarea name="notes" rows={3} className={inputClass} placeholder="Scope assumptions, validity terms…" />
          </Field>

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Create quotation</PrimaryButton>
            <GhostLink href="/quotations">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
