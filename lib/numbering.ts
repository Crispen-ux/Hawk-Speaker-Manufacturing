import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

async function ensureSettingsRow() {
  const existing = await db.select().from(settings).where(eq(settings.id, 1));
  if (existing.length === 0) {
    await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  }
}

export async function nextInvoiceNumber() {
  await ensureSettingsRow();
  const rows = await db
    .update(settings)
    .set({ nextInvoiceNumber: sql`${settings.nextInvoiceNumber} + 1` })
    .where(eq(settings.id, 1))
    .returning({
      n: settings.nextInvoiceNumber,
      prefix: settings.invoicePrefix,
    });
  const row = rows[0];
  const used = row.n - 1;
  return `${row.prefix}${String(used).padStart(4, "0")}`;
}

export async function nextQuotationNumber() {
  await ensureSettingsRow();
  const rows = await db
    .update(settings)
    .set({ nextQuotationNumber: sql`${settings.nextQuotationNumber} + 1` })
    .where(eq(settings.id, 1))
    .returning({
      n: settings.nextQuotationNumber,
      prefix: settings.quotationPrefix,
    });
  const row = rows[0];
  const used = row.n - 1;
  return `${row.prefix}${String(used).padStart(4, "0")}`;
}

export async function getSettings() {
  await ensureSettingsRow();
  const rows = await db.select().from(settings).where(eq(settings.id, 1));
  return rows[0];
}
