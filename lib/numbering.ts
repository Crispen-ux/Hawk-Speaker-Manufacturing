import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

async function ensureSettingsRow() {
  const existing = await db.select().from(settings).where(eq(settings.id, 1));
  if (existing.length === 0) {
    await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  }
}

type NumberField =
  | "nextInvoiceNumber"
  | "nextQuotationNumber"
  | "nextPurchaseOrderNumber"
  | "nextJobCardNumber"
  | "nextDeliveryNoteNumber"
  | "nextCreditNoteNumber"
  | "nextReceiptNumber"
  | "nextJournalNumber"
  | "nextSupplierBillNumber";
type PrefixField =
  | "invoicePrefix"
  | "quotationPrefix"
  | "purchaseOrderPrefix"
  | "jobCardPrefix"
  | "deliveryNotePrefix"
  | "creditNotePrefix"
  | "receiptPrefix"
  | "journalPrefix"
  | "supplierBillPrefix";

async function nextNumber(numberField: NumberField, prefixField: PrefixField) {
  await ensureSettingsRow();
  const rows = await db
    .update(settings)
    .set({ [numberField]: sql`${settings[numberField]} + 1` })
    .where(eq(settings.id, 1))
    .returning({ n: settings[numberField], prefix: settings[prefixField] });
  const row = rows[0];
  const used = row.n - 1;
  return `${row.prefix}${String(used).padStart(4, "0")}`;
}

export const nextInvoiceNumber = () => nextNumber("nextInvoiceNumber", "invoicePrefix");
export const nextQuotationNumber = () => nextNumber("nextQuotationNumber", "quotationPrefix");
export const nextPurchaseOrderNumber = () => nextNumber("nextPurchaseOrderNumber", "purchaseOrderPrefix");
export const nextJobCardNumber = () => nextNumber("nextJobCardNumber", "jobCardPrefix");
export const nextDeliveryNoteNumber = () => nextNumber("nextDeliveryNoteNumber", "deliveryNotePrefix");
export const nextCreditNoteNumber = () => nextNumber("nextCreditNoteNumber", "creditNotePrefix");
export const nextReceiptNumber = () => nextNumber("nextReceiptNumber", "receiptPrefix");
export const nextJournalNumber = () => nextNumber("nextJournalNumber", "journalPrefix");
export const nextSupplierBillNumber = () => nextNumber("nextSupplierBillNumber", "supplierBillPrefix");

export async function getSettings() {
  await ensureSettingsRow();
  const rows = await db.select().from(settings).where(eq(settings.id, 1));
  return rows[0];
}
