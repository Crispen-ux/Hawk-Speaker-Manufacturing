"use server";

import { db } from "@/db";
import {
  suppliers,
  purchaseOrders,
  purchaseOrderItems,
  supplierBills,
  supplierBillItems,
  expenses,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";

export async function createSupplier(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  const [row] = await db
    .insert(suppliers)
    .values({
      name,
      email: String(formData.get("email") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      registrationNumber: String(formData.get("registrationNumber") ?? "") || null,
      vatNumber: String(formData.get("vatNumber") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    })
    .returning({ id: suppliers.id });

  revalidatePath("/suppliers");
  redirect(flashUrl(`/suppliers/${row.id}` , "Supplier created"));
}

export async function updateSupplier(id: number, formData: FormData) {
  await db
    .update(suppliers)
    .set({
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      registrationNumber: String(formData.get("registrationNumber") ?? "") || null,
      vatNumber: String(formData.get("vatNumber") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    })
    .where(eq(suppliers.id, id));

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
}

export async function deleteSupplier(id: number) {
  // Delete the supplier inside a transaction, clearing related rows first so the
  // delete succeeds regardless of how the FK constraints are configured in the
  // deployed database (cascade vs. restrict). This mirrors what ON DELETE CASCADE
  // would do anyway, but is robust across environments.
  await db.transaction(async (tx) => {
    const poIds = (await tx.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.supplierId, id))).map((r) => r.id);
    if (poIds.length > 0) await tx.delete(purchaseOrderItems).where(inArray(purchaseOrderItems.purchaseOrderId, poIds));
    if (poIds.length > 0) await tx.delete(purchaseOrders).where(inArray(purchaseOrders.id, poIds));

    const sbIds = (await tx.select({ id: supplierBills.id }).from(supplierBills).where(eq(supplierBills.supplierId, id))).map((r) => r.id);
    if (sbIds.length > 0) await tx.delete(supplierBillItems).where(inArray(supplierBillItems.supplierBillId, sbIds));
    if (sbIds.length > 0) await tx.delete(supplierBills).where(inArray(supplierBills.id, sbIds));

    // Expenses keep their history, just unlinked from the supplier.
    await tx.update(expenses).set({ supplierId: null }).where(eq(expenses.supplierId, id));

    await tx.delete(suppliers).where(eq(suppliers.id, id));
  });

  revalidatePath("/suppliers");
  redirect(flashUrl(`/suppliers`, "Supplier deleted"));
}
