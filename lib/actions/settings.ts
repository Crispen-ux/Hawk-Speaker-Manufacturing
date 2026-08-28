"use server";

import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/email-templates";

const EMAIL_DOC_KINDS = ["invoice", "quotation", "statement", "purchaseOrder", "jobCard", "deliveryNote"] as const;

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

  const int = (key: string, fallback: number) => {
    const raw = formData.get(key);
    if (typeof raw !== "string" || raw.trim() === "") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
  };

  const str = (key: string, fallback = "") => String(formData.get(key) ?? fallback);

  const base = {
    companyName: str("companyName", "Your Company"),
    registrationNumber: str("registrationNumber") || null,
    vatNumber: str("vatNumber") || null,
    email: str("email") || null,
    phone: str("phone") || null,
    address: str("address") || null,
    bankDetails: str("bankDetails") || null,
    currency: str("currency", "R") || "R",
    defaultTaxRate: str("defaultTaxRate", "0"),
    taxIncluded: formData.get("taxIncluded") === "on",
    paymentTerms: str("paymentTerms") || null,
    paymentTermsDays: int("paymentTermsDays", 14),
    invoiceFooter: str("invoiceFooter") || null,
    invoicePrefix: str("invoicePrefix", "INV-"),
    quotationPrefix: str("quotationPrefix", "QUO-"),
    purchaseOrderPrefix: str("purchaseOrderPrefix", "PO-"),
    jobCardPrefix: str("jobCardPrefix", "JOB-"),
    deliveryNotePrefix: str("deliveryNotePrefix", "DN-"),
    nextInvoiceNumber: int("nextInvoiceNumber", 1),
    nextQuotationNumber: int("nextQuotationNumber", 1),
    nextPurchaseOrderNumber: int("nextPurchaseOrderNumber", 1),
    nextJobCardNumber: int("nextJobCardNumber", 1),
    nextDeliveryNoteNumber: int("nextDeliveryNoteNumber", 1),
  };

  // Email templates come in as individual fields named
  // `emailTemplates.<kind>.subject` / `emailTemplates.<kind>.greeting`.
  const emailTemplates: Record<string, { subject: string; greeting: string }> = {};
  for (const kind of EMAIL_DOC_KINDS) {
    const fallback = DEFAULT_EMAIL_TEMPLATES[kind] ?? { subject: "", greeting: "" };
    emailTemplates[kind] = {
      subject: str(`emailTemplates.${kind}.subject`, fallback.subject),
      greeting: str(`emailTemplates.${kind}.greeting`, fallback.greeting),
    };
  }

  const emailTemplatesJson = JSON.stringify(emailTemplates);

  const whatsappRaw = str("whatsappTemplates");
  let whatsappTemplates: string | null = null;
  if (whatsappRaw.trim()) {
    try {
      JSON.parse(whatsappRaw);
      whatsappTemplates = whatsappRaw;
    } catch {
      // Keep the previously saved value if the JSON is invalid.
      const row = await db.select().from(settings).where(eq(settings.id, 1));
      whatsappTemplates = row[0]?.whatsappTemplates ?? null;
    }
  }

  await db
    .insert(settings)
    .values({ id: 1, ...base, ...logoPatch, emailTemplates: emailTemplatesJson, whatsappTemplates })
    .onConflictDoUpdate({
      target: settings.id,
      set: { ...base, ...logoPatch, emailTemplates: emailTemplatesJson, whatsappTemplates },
    });

  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/invoices");
}