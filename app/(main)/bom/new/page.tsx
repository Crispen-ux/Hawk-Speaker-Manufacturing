import { db } from "@/db";
import { catalogItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createBom } from "@/lib/actions/bom";
import { getSettings } from "@/lib/numbering";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";
import BomItemsEditor from "@/components/BomItemsEditor";

export const dynamic = "force-dynamic";

export default async function NewBomPage() {
  const settings = await getSettings();
  const catalog = await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.name);

  return (
    <div>
      <PageHeader eyebrow="Production" title="New bill of materials" />
      <Card className="max-w-4xl">
        <form action={createBom} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name">
              <input name="name" required className={inputClass} placeholder="Server room AC service" />
            </Field>
            <Field label="Finished product (optional)">
              <select name="catalogItemId" className={inputClass}>
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
            <textarea name="description" rows={2} className={inputClass} placeholder="What this BOM covers…" />
          </Field>

          <BomItemsEditor initialItems={[]} catalogItems={catalog} currency={settings.currency} />

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Create BOM</PrimaryButton>
            <GhostLink href="/bom">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
