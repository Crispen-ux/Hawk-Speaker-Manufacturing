"use server";

import { db } from "@/db";
import { inventoryMovements } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";

export async function recordMovement(formData: FormData) {
  const itemId = Number(formData.get("catalogItemId"));
  const qty = Number(formData.get("qty"));
  const direction = String(formData.get("direction") ?? "in");
  if (!itemId) throw new Error("Choose a product");
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("Quantity must be a positive number");

  await db.insert(inventoryMovements).values({
    catalogItemId: itemId,
    deltaQty: String(direction === "out" ? -qty : qty),
    reason: String(formData.get("reason") ?? "adjustment"),
    reference: String(formData.get("reference") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
  });

  revalidatePath("/inventory");
  revalidatePath("/inventory/movements");
  redirect(flashUrl(`/inventory` , "Movement recorded"));
}

export async function deleteMovement(id: number) {
  const [row] = await db.select().from(inventoryMovements).where(eq(inventoryMovements.id, id));
  if (row) {
    await db.delete(inventoryMovements).where(eq(inventoryMovements.id, id));
    revalidatePath("/inventory");
    revalidatePath("/inventory/movements");
  }
  redirect(flashUrl(`/inventory/movements`, "Movement deleted"));
}