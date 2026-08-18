"use server";

import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateSettings(formData: FormData) {
  await db
    .insert(settings)
    .values({
      id: 1,
      companyName: String(formData.get("companyName") ?? "Your Company"),
      email: String(formData.get("email") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      bankDetails: String(formData.get("bankDetails") ?? "") || null,
      defaultTaxRate: String(formData.get("defaultTaxRate") ?? "0"),
      invoicePrefix: String(formData.get("invoicePrefix") ?? "INV-"),
      quotationPrefix: String(formData.get("quotationPrefix") ?? "QUO-"),
    })
    .onConflictDoUpdate({
      target: settings.id,
      set: {
        companyName: String(formData.get("companyName") ?? "Your Company"),
        email: String(formData.get("email") ?? "") || null,
        phone: String(formData.get("phone") ?? "") || null,
        address: String(formData.get("address") ?? "") || null,
        bankDetails: String(formData.get("bankDetails") ?? "") || null,
        defaultTaxRate: String(formData.get("defaultTaxRate") ?? "0"),
        invoicePrefix: String(formData.get("invoicePrefix") ?? "INV-"),
        quotationPrefix: String(formData.get("quotationPrefix") ?? "QUO-"),
      },
    });

  revalidatePath("/settings");
}
