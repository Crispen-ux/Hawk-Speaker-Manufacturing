import { recordMovement } from "@/lib/actions/inventory";
import { db } from "@/db";
import { catalogItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewMovementPage() {
  const items = await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(catalogItems.name);

  return (
    <div>
      <PageHeader eyebrow="Stock" title="Record movement" />
      <Card className="max-w-2xl">
        <form action={recordMovement} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Product">
              <select name="catalogItemId" required className={inputClass}>
                <option value="">— Choose —</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quantity">
              <input name="qty" type="number" min="0.01" step="0.01" inputMode="decimal" required className={inputClass} />
            </Field>
            <Field label="Direction">
              <select name="direction" defaultValue="in" className={inputClass}>
                <option value="in">Stock in (received)</option>
                <option value="out">Stock out (used / sold)</option>
              </select>
            </Field>
            <Field label="Reason">
              <select name="reason" defaultValue="adjustment" className={inputClass}>
                {["purchase", "sale", "adjustment", "write_off", "return"].map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reference (optional)">
              <input name="reference" className={inputClass} placeholder="e.g. PO-0001, INV-0002" />
            </Field>
          </div>
          <Field label="Notes">
            <textarea name="notes" rows={3} className={inputClass} />
          </Field>
          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Save movement</PrimaryButton>
            <GhostLink href="/inventory">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}