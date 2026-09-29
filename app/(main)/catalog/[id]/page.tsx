import { db } from "@/db";
import { catalogItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { updateCatalogItem, deleteCatalogItem } from "@/lib/actions/catalog";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";
import ConfirmForm from "@/components/ConfirmForm";

export const dynamic = "force-dynamic";

export default async function EditCatalogItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = Number(id);
  const [item] = await db.select().from(catalogItems).where(eq(catalogItems.id, itemId));
  if (!item) notFound();

  const updateWithId = updateCatalogItem.bind(null, itemId);
  const removeWithId = deleteCatalogItem.bind(null, itemId);

  return (
    <div>
      <PageHeader eyebrow="Products & services" title={item.name} />
      <Card className="max-w-xl">
        <form action={updateWithId} className="space-y-4">
          <Field label="Name">
            <input name="name" defaultValue={item.name} required className={inputClass} />
          </Field>
          <Field label="Description (optional)">
            <textarea name="description" defaultValue={item.description ?? ""} rows={2} className={inputClass} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Unit price">
              <input name="unitPrice" defaultValue={item.unitPrice} required inputMode="decimal" className={inputClass} />
            </Field>
            <Field label="Unit (optional)">
              <input name="unit" defaultValue={item.unit ?? ""} className={inputClass} />
            </Field>
          </div>
          <div className="flex items-center justify-between pt-2">
            <PrimaryButton type="submit">Save changes</PrimaryButton>
            <div className="flex items-center gap-4">
              <GhostLink href="/catalog">Cancel</GhostLink>
              <ConfirmForm action={removeWithId} confirm="Delete this product? Old invoices still referencing it will keep their descriptions.">
                <button type="submit" className="font-mono text-xs uppercase tracking-wide text-rust hover:underline">
                  Delete
                </button>
              </ConfirmForm>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
