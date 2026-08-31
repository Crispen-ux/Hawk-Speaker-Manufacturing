"use server";

import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";
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
  await db.delete(suppliers).where(eq(suppliers.id, id));
  revalidatePath("/suppliers");
  redirect(flashUrl(`/suppliers` , "Supplier deleted"));
}
