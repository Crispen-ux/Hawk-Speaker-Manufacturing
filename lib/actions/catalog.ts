"use server";

import { db } from "@/db";
import { catalogItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createCatalogItem(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  await db.insert(catalogItems).values({
    name,
    description: String(formData.get("description") ?? "") || null,
    unit: String(formData.get("unit") ?? "") || null,
    unitPrice: String(formData.get("unitPrice") ?? "0"),
  });

  revalidatePath("/catalog");
  redirect("/catalog");
}

export async function updateCatalogItem(id: number, formData: FormData) {
  await db
    .update(catalogItems)
    .set({
      name: String(formData.get("name") ?? "").trim(),
      description: String(formData.get("description") ?? "") || null,
      unit: String(formData.get("unit") ?? "") || null,
      unitPrice: String(formData.get("unitPrice") ?? "0"),
    })
    .where(eq(catalogItems.id, id));

  revalidatePath("/catalog");
  redirect("/catalog");
}

export async function toggleCatalogItemActive(id: number, active: boolean) {
  await db.update(catalogItems).set({ active }).where(eq(catalogItems.id, id));
  revalidatePath("/catalog");
}

export async function deleteCatalogItem(id: number) {
  await db.delete(catalogItems).where(eq(catalogItems.id, id));
  revalidatePath("/catalog");
}
