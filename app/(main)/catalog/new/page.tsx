import { createCatalogItem } from "@/lib/actions/catalog";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";

export default function NewCatalogItemPage() {
  return (
    <div>
      <PageHeader eyebrow="Products & services" title="New catalogue item" />
      <Card className="max-w-xl">
        <form action={createCatalogItem} className="space-y-4">
          <Field label="Name">
            <input name="name" required className={inputClass} placeholder="Web hosting — Standard plan" />
          </Field>
          <Field label="Description (optional)">
            <textarea name="description" rows={2} className={inputClass} placeholder="Shown under the name when you add it to a line item" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Unit price">
              <input name="unitPrice" required inputMode="decimal" className={inputClass} placeholder="0.00" />
            </Field>
            <Field label="Unit (optional)">
              <input name="unit" className={inputClass} placeholder="month, hour, license…" />
            </Field>
          </div>
          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Save item</PrimaryButton>
            <GhostLink href="/catalog">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
