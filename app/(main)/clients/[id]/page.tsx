import { db } from "@/db";
import { clients, invoices, quotations } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { updateClient, deleteClient } from "@/lib/actions/clients";
import { PageHeader, Field, inputClass, PrimaryButton, Card } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import { formatDate } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = Number(id);
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!client) notFound();

  const clientInvoices = await db
    .select()
    .from(invoices)
    .where(eq(invoices.clientId, clientId))
    .orderBy(desc(invoices.createdAt));

  const clientQuotations = await db
    .select()
    .from(quotations)
    .where(eq(quotations.clientId, clientId))
    .orderBy(desc(quotations.createdAt));

  const updateWithId = updateClient.bind(null, clientId);
  const deleteWithId = deleteClient.bind(null, clientId);

  return (
    <div>
      <PageHeader eyebrow="Client file" title={client.name} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
        <Card>
          <form action={updateWithId} className="space-y-4">
            <Field label="Name">
              <input name="name" defaultValue={client.name} required className={inputClass} />
            </Field>
            <Field label="Email">
              <input name="email" defaultValue={client.email ?? ""} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input name="phone" defaultValue={client.phone ?? ""} className={inputClass} />
            </Field>
            <Field label="Billing address">
              <textarea name="address" defaultValue={client.address ?? ""} rows={3} className={inputClass} />
            </Field>
            <Field label="Notes">
              <textarea name="notes" defaultValue={client.notes ?? ""} rows={2} className={inputClass} />
            </Field>
            <div className="flex items-center justify-between pt-2">
              <PrimaryButton type="submit">Save changes</PrimaryButton>
              <form action={deleteWithId}>
                <button type="submit" className="font-mono text-xs uppercase tracking-wide text-rust hover:underline">
                  Delete client
                </button>
              </form>
            </div>
          </form>
        </Card>

        <div className="space-y-8">
          <div>
            <h2 className="mb-3 font-display text-lg italic text-ink">Invoices</h2>
            {clientInvoices.length === 0 ? (
              <p className="text-sm text-ink-soft">No invoices for this client yet.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-rule">
                <table className="w-full text-sm">
                  <tbody>
                    {clientInvoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                        <td className="px-4 py-2.5">
                          <Link href={`/invoices/${inv.id}`} className="font-mono text-ink hover:text-forest">
                            {inv.number}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-ink-soft">{formatDate(inv.issueDate)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <StatusStamp status={inv.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 font-display text-lg italic text-ink">Quotations</h2>
            {clientQuotations.length === 0 ? (
              <p className="text-sm text-ink-soft">No quotations for this client yet.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-rule">
                <table className="w-full text-sm">
                  <tbody>
                    {clientQuotations.map((q) => (
                      <tr key={q.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                        <td className="px-4 py-2.5">
                          <Link href={`/quotations/${q.id}`} className="font-mono text-ink hover:text-forest">
                            {q.number}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-ink-soft">{formatDate(q.issueDate)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <StatusStamp status={q.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
