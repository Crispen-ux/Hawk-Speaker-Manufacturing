"use server";

import { db } from "@/db";
import { assets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";
import { toNumber } from "@/lib/money";
import { postAssetAcquired } from "@/lib/accounting/posting";

export async function createAsset(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim(); if (!name) throw new Error("Name is required");
  const value = toNumber(String(formData.get("value") ?? "0")); const purchaseDate = String(formData.get("purchaseDate") ?? "") || null;
  const [row] = await db.insert(assets).values({ name, category: String(formData.get("category") ?? "") || null, serialNumber: String(formData.get("serialNumber") ?? "") || null, value: value.toFixed(2), purchaseDate, status: "active", notes: String(formData.get("notes") ?? "") || null }).returning({ id: assets.id });
  if (value > 0 && purchaseDate) await postAssetAcquired({ assetId: row.id, date: purchaseDate, value, name });
  revalidatePath("/assets"); revalidatePath("/accounting/balance-sheet"); revalidatePath("/accounting/trial-balance"); redirect(flashUrl(`/assets/${row.id}`, "Asset created"));
}

export async function updateAsset(id: number, formData: FormData) {
  const [existing] = await db.select().from(assets).where(eq(assets.id, id)).limit(1); if (!existing) throw new Error("Asset not found");
  if (existing.purchaseDate) throw new Error("Purchased assets are locked. Use an adjustment journal for corrections or disposal.");
  await db.update(assets).set({ name: String(formData.get("name") ?? "").trim(), category: String(formData.get("category") ?? "") || null, serialNumber: String(formData.get("serialNumber") ?? "") || null, value: String(formData.get("value") ?? "0"), purchaseDate: String(formData.get("purchaseDate") ?? "") || null, notes: String(formData.get("notes") ?? "") || null }).where(eq(assets.id, id));
  revalidatePath("/assets"); revalidatePath(`/assets/${id}`); redirect(flashUrl(`/assets/${id}`, "Asset updated"));
}

export async function setAssetStatus(id: number, status: (typeof assets.status.enumValues)[number]) {
  await db.update(assets).set({ status }).where(eq(assets.id, id)); revalidatePath("/assets"); revalidatePath(`/assets/${id}`); revalidatePath("/accounting/balance-sheet");
}

export async function deleteAsset(id: number) {
  const [existing] = await db.select().from(assets).where(eq(assets.id, id)).limit(1); if (!existing) return; if (existing.purchaseDate) throw new Error("Purchased assets cannot be deleted. Dispose or adjust them through accounting.");
  await db.delete(assets).where(eq(assets.id, id)); revalidatePath("/assets"); redirect(flashUrl(`/assets`, "Asset deleted"));
}
