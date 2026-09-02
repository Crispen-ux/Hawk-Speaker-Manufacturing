"use server";

import { db } from "@/db";
import { bomHeaders, bomItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";

type VatTreatment = (typeof bomItems.$inferInsert)["vatTreatment"] & string;
type ParsedItem = {
  catalogItemId?: string;
  description?: string;
  quantity?: string;
  unitCost?: string;
  markup?: string;
  vatTreatment?: VatTreatment;
};

function toVat(value: string): (typeof bomItems.$inferInsert)["vatTreatment"] {
  if (value === "zero_rated" || value === "exempt") return value;
  return "standard";
}

function parseItems(formData: FormData): ParsedItem[] {
  try {
    return JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return [];
  }
}

export async function createBom(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  const catalogItemId = formData.get("catalogItemId");
  const description = String(formData.get("description") ?? "") || null;
  const items = parseItems(formData).filter((it) => String(it.description ?? "").trim() !== "");

  const [header] = await db
    .insert(bomHeaders)
    .values({
      name,
      description,
      catalogItemId: catalogItemId ? Number(catalogItemId) : null,
    })
    .returning({ id: bomHeaders.id });

  if (items.length > 0) {
    await db.insert(bomItems).values(
      items.map((it, i) => ({
        bomId: header.id,
        catalogItemId: it.catalogItemId ? Number(it.catalogItemId) : null,
        description: String(it.description ?? "").trim(),
        quantity: String(it.quantity ?? "1"),
        unitCost: String(it.unitCost ?? "0"),
        markup: String(it.markup ?? "0"),
        vatTreatment: toVat(String(it.vatTreatment ?? "standard")),
        sortOrder: i,
      }))
    );
  }

  revalidatePath("/bom");
  redirect(flashUrl(`/bom/${header.id}`, "Bill of materials created"));
}

export async function updateBom(id: number, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  const catalogItemId = formData.get("catalogItemId");
  const description = String(formData.get("description") ?? "") || null;

  await db
    .update(bomHeaders)
    .set({
      name,
      description,
      catalogItemId: catalogItemId ? Number(catalogItemId) : null,
    })
    .where(eq(bomHeaders.id, id));

  const items = parseItems(formData).filter((it) => String(it.description ?? "").trim() !== "");
  await db.delete(bomItems).where(eq(bomItems.bomId, id));
  if (items.length > 0) {
    await db.insert(bomItems).values(
      items.map((it, i) => ({
        bomId: id,
        catalogItemId: it.catalogItemId ? Number(it.catalogItemId) : null,
        description: String(it.description ?? "").trim(),
        quantity: String(it.quantity ?? "1"),
        unitCost: String(it.unitCost ?? "0"),
        markup: String(it.markup ?? "0"),
        vatTreatment: toVat(String(it.vatTreatment ?? "standard")),
        sortOrder: i,
      }))
    );
  }

  revalidatePath("/bom");
  revalidatePath(`/bom/${id}`);
  redirect(flashUrl(`/bom/${id}`, "Bill of materials updated"));
}

export async function deleteBom(id: number) {
  const [header] = await db.select().from(bomHeaders).where(eq(bomHeaders.id, id));
  if (!header) return;
  await db.delete(bomHeaders).where(eq(bomHeaders.id, id));
  revalidatePath("/bom");
  redirect(flashUrl("/bom", "Bill of materials deleted"));
}
