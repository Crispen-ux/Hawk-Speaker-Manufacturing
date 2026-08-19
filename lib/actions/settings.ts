"use server";

import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateSettings(formData: FormData) {
  const logoData = formData.get("logoData");
  const removeLogo = formData.get("removeLogo") === "1";
  const logoDarkData = formData.get("logoDarkData");
  const removeLogoDark = formData.get("removeLogoDark") === "1";

  // logoData/logoDarkData are only sent (as data: URI strings) when the user
  // picked a new file; when unchanged, the hidden field is omitted so we keep
  // the existing logo. The "remove" flags clear them explicitly.
  const logoPatch: { logoData?: string | null; logoDarkData?: string | null } = {};
  if (removeLogo) {
    logoPatch.logoData = null;
  } else if (typeof logoData === "string" && logoData.startsWith("data:")) {
    logoPatch.logoData = logoData;
  }
  if (removeLogoDark) {
    logoPatch.logoDarkData = null;
  } else if (typeof logoDarkData === "string" && logoDarkData.startsWith("data:")) {
    logoPatch.logoDarkData = logoDarkData;
  }

  const base = {
    companyName: String(formData.get("companyName") ?? "Your Company"),
    email: String(formData.get("email") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
    address: String(formData.get("address") ?? "") || null,
    bankDetails: String(formData.get("bankDetails") ?? "") || null,
    defaultTaxRate: String(formData.get("defaultTaxRate") ?? "0"),
    invoicePrefix: String(formData.get("invoicePrefix") ?? "INV-"),
    quotationPrefix: String(formData.get("quotationPrefix") ?? "QUO-"),
  };

  await db
    .insert(settings)
    .values({ id: 1, ...base, ...logoPatch })
    .onConflictDoUpdate({
      target: settings.id,
      set: { ...base, ...logoPatch },
    });

  revalidatePath("/settings");
  revalidatePath("/");
}
