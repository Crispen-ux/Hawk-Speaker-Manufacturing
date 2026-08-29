"use server";

import { db } from "@/db";
import { assets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";

export async function createAsset(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  const [row] = await db
    .insert(assets)
    .values({
      name,
      category: String(formData.get("category") ?? "") || null,
      serialNumber: String(formData.get("serialNumber") ?? "") || null,
      value: String(formData.get("value") ?? "0"),
      purchaseDate: String(formData.get("purchaseDate") ?? "") || null,
      status: "active",
      notes: String(formData.get("notes") ?? "") || null,
    })
    .returning({ id: assets.id });

  revalidatePath("/assets");
  redirect(flashUrl(`/assets/${row.id}` , "Asset created"));
}

export async function updateAsset(id: number, formData: FormData) {
  await db
    .update(assets)
    .set({
      name: String(formData.get("name") ?? "").trim(),
      category: String(formData.get("category") ?? "") || null,
      serialNumber: String(formData.get("serialNumber") ?? "") || null,
      value: String(formData.get("value") ?? "0"),
      purchaseDate: String(formData.get("purchaseDate") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    })
    .where(eq(assets.id, id));

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  redirect(flashUrl(`/assets/${id}` , "Asset updated"));
}

export async function setAssetStatus(id: number, status: (typeof assets.status.enumValues)[number]) {
  await db.update(assets).set({ status }).where(eq(assets.id, id));
  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
}

export async function deleteAsset(id: number) {
  await db.delete(assets).where(eq(assets.id, id));
  revalidatePath("/assets");
  redirect(flashUrl(`/assets` , "Asset deleted"));
}