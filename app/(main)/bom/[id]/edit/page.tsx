import { db } from "@/db";
import { bomHeaders, bomItems, catalogItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { updateBom } from "@/lib/actions/bom";
import { getSettings } from "@/lib/numbering";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";
import BomItemsEditor, { type BomItem } from "@/components/BomItemsEditor";

export const dynamic = "force-dynamic";

export default async function EditBomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bomId = Number(id);
  const [header] = await db.select().from(bomHeaders).where(eq(bomHeaders.id, bomId));
  if (!header) notFound();

  const settings = await getSettings();
  const catalog = await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.name);
  const rows = await db.select().from(bomItems).where(eq(bomItems.bomId, bomId)).orderBy(bomItems.sortOrder);

  const initialItems: BomItem[] = rows.map((it) => ({
    catalogItemId: it.catalogItemId ? String(it.catalogItemId) : "",
    description: it.description,
    quantity: it.quantity,
    unitCost: it.unitCost,
    markup: it.markup,
    vatTreatment: it.vatTreatment,
  }));

  const updateWithId = updateBom.bind(null, bomId);

  return (
    <div>
      <PageHeader eyebrow="Production" title={`Edit ${header.name}`} />
      <Card className="max-w-4xl">
        <form action={updateWithId} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name">
              <input name="name" defaultValue={header.name} required className={inputClass} />
            </Field>
            <Field label="Finished product (optional)">
              <select name="catalogItemId" defaultValue={header.catalogItemId ?? ""} className={inputClass}>
                <option value="">None</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Description">
            <textarea name="description" defaultValue={header.description ?? ""} rows={2} className={inputClass} />
          </Field>

          <BomItemsEditor initialItems={initialItems} catalogItems={catalog} currency={settings.currency} />

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Save changes</PrimaryButton>
            <GhostLink href={`/bom/${bomId}`}>Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
