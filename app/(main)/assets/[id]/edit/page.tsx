import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { assets } from "@/db/schema";
import { updateAsset } from "@/lib/actions/assets";
import { getSettings } from "@/lib/numbering";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assetId = Number(id);
  const settings = await getSettings();

  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId));
  if (!asset) notFound();
  const save = updateAsset.bind(null, assetId);

  return (
    <div>
      <PageHeader eyebrow="Assets" title={`Edit ${asset.name}`} />
      <Card className="max-w-2xl">
        <form action={save} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input name="name" required defaultValue={asset.name} className={inputClass} />
            </Field>
            <Field label="Category">
              <input name="category" defaultValue={asset.category ?? ""} className={inputClass} />
            </Field>
            <Field label="Serial number">
              <input name="serialNumber" defaultValue={asset.serialNumber ?? ""} className={inputClass} />
            </Field>
            <Field label={`Value (${settings.currency || "R"})`}>
              <input name="value" inputMode="decimal" defaultValue={String(asset.value)} className={inputClass} />
            </Field>
            <Field label="Purchase date">
              <input type="date" name="purchaseDate" defaultValue={asset.purchaseDate ?? ""} className={inputClass} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea name="notes" rows={3} defaultValue={asset.notes ?? ""} className={inputClass} />
          </Field>
          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Save changes</PrimaryButton>
            <GhostLink href={`/assets/${assetId}`}>Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}