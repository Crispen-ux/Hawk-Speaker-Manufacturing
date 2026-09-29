import { createAsset } from "@/lib/actions/assets";
import { getSettings } from "@/lib/numbering";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewAssetPage() {
  const settings = await getSettings();
  return (
    <div>
      <PageHeader eyebrow="Assets" title="Add asset" />
      <Card className="max-w-2xl">
        <form action={createAsset} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input name="name" required className={inputClass} placeholder="e.g. Laptop – Dell XPS 13" />
            </Field>
            <Field label="Category">
              <input name="category" className={inputClass} placeholder="e.g. Computers, Vehicles, Tools" />
            </Field>
            <Field label="Serial number">
              <input name="serialNumber" className={inputClass} placeholder="Optional" />
            </Field>
            <Field label={`Value (${settings.currency || "R"})`}>
              <input name="value" inputMode="decimal" defaultValue="0" className={inputClass} />
            </Field>
            <Field label="Purchase date">
              <input type="date" name="purchaseDate" className={inputClass} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea name="notes" rows={3} className={inputClass} />
          </Field>
          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Add asset</PrimaryButton>
            <GhostLink href="/assets">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}