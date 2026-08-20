import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { clients, jobCards, catalogItems } from "@/db/schema";
import { updateJobCard } from "@/lib/actions/jobCards";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";
import LineItemsEditor from "@/components/LineItemsEditor";

export const dynamic = "force-dynamic";

export default async function EditJobCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = Number(id);

  const job = await db.query.jobCards.findFirst({
    where: eq(jobCards.id, jobId),
    with: { items: true },
  });
  if (!job) notFound();

  const allClients = await db.select().from(clients).orderBy(clients.name);
  const catalog = await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.name);
  const updateWithId = updateJobCard.bind(null, jobId);

  return (
    <div>
      <PageHeader eyebrow="Field work" title={`Edit ${job.number}`} />
      <Card className="max-w-3xl">
        <form action={updateWithId} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client">
              <select name="clientId" required defaultValue={job.clientId} className={inputClass}>
                {allClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Opened date">
              <input type="date" name="openedDate" defaultValue={job.openedDate} required className={inputClass} />
            </Field>
          </div>

          <Field label="Job title">
            <input name="title" defaultValue={job.title} required className={inputClass} />
          </Field>

          <Field label="Description">
            <textarea name="description" defaultValue={job.description ?? ""} rows={3} className={inputClass} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Technician">
              <input name="technician" defaultValue={job.technician ?? ""} className={inputClass} />
            </Field>
            <Field label="Equipment / asset">
              <input name="equipment" defaultValue={job.equipment ?? ""} className={inputClass} />
            </Field>
          </div>

          <Field label="Completed date">
            <input type="date" name="completedDate" defaultValue={job.completedDate ?? ""} className={`${inputClass} max-w-xs`} />
          </Field>

          <LineItemsEditor
            initialItems={job.items.map((it) => ({
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
            }))}
            initialTaxRate={job.taxRate}
            initialDiscount={job.discount}
            catalogItems={catalog}
          />

          <Field label="Notes (carried onto the invoice if converted)">
            <textarea name="notes" defaultValue={job.notes ?? ""} rows={2} className={inputClass} />
          </Field>

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Save changes</PrimaryButton>
            <GhostLink href={`/job-cards/${job.id}`}>Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
