import { db } from "@/db";
import { recurringInvoices, invoices, invoiceItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nextInvoiceNumber } from "@/lib/numbering";
import { sendInvoiceByEmail } from "@/lib/send";
import { notify } from "@/lib/actions/notifications";

function advanceDate(dateStr: string, frequency: string) {
  const d = new Date(dateStr + "T00:00:00");
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Generates one invoice from a recurring profile, advances its nextRunDate,
 * and — if the profile has auto-send on and the client has an email —
 * emails it immediately. Auto-send failures don't block invoice creation;
 * they're logged and the invoice stays as a draft for manual follow-up.
 */
export async function generateInvoiceFromRecurring(recurringId: number) {
  const rec = await db.query.recurringInvoices.findFirst({
    where: eq(recurringInvoices.id, recurringId),
    with: { items: true, client: true },
  });
  if (!rec) throw new Error("Recurring profile not found");
  if (rec.items.length === 0) throw new Error("This recurring profile has no line items");

  const number = await nextInvoiceNumber();
  const issueDate = new Date().toISOString().slice(0, 10);
  const due = new Date();
  due.setDate(due.getDate() + rec.dueInDays);
  const dueDate = due.toISOString().slice(0, 10);

  const [inv] = await db
    .insert(invoices)
    .values({
      number,
      clientId: rec.clientId,
      issueDate,
      dueDate,
      taxRate: rec.taxRate,
      discount: rec.discount,
      notes: rec.notes,
      status: "draft",
      recurringInvoiceId: rec.id,
    })
    .returning({ id: invoices.id });

  await db.insert(invoiceItems).values(
    rec.items.map((it, i) => ({
      invoiceId: inv.id,
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      sortOrder: i,
    }))
  );

  const nextRunDate = advanceDate(rec.nextRunDate, rec.frequency);
  await db
    .update(recurringInvoices)
    .set({ nextRunDate, lastGeneratedAt: new Date(), lastInvoiceId: inv.id })
    .where(eq(recurringInvoices.id, recurringId));

  let autoSendError: string | null = null;
  if (rec.autoSend && rec.client?.email) {
    try {
      await sendInvoiceByEmail(inv.id, rec.client.email);
    } catch (e) {
      autoSendError = e instanceof Error ? e.message : "Auto-send failed";
      console.error(`Auto-send failed for recurring invoice ${recurringId}:`, autoSendError);
    }
  }

  void notify({
    title: `Recurring invoice ${number} generated`,
    message: `From schedule for ${rec.client?.name ?? "client"}`,
    documentKind: "invoice",
    documentId: inv.id,
    level: "info",
  });

  return { invoiceId: inv.id, autoSendError };
}

/** Runs every active, due recurring profile. Used by the daily cron job. */
export async function runDueRecurringInvoices() {
  const today = new Date().toISOString().slice(0, 10);
  const due = await db.query.recurringInvoices.findMany({
    where: eq(recurringInvoices.active, true),
  });

  const results: { recurringId: number; invoiceId?: number; error?: string }[] = [];

  for (const rec of due) {
    if (rec.nextRunDate > today) continue;
    try {
      const { invoiceId, autoSendError } = await generateInvoiceFromRecurring(rec.id);
      results.push({ recurringId: rec.id, invoiceId, error: autoSendError ?? undefined });
    } catch (e) {
      results.push({ recurringId: rec.id, error: e instanceof Error ? e.message : "Failed" });
    }
  }

  return results;
}
