import { db } from "@/db";
import { automations, automationSteps } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Idempotently seeds the built-in "Convert Approved Quotations" workflow so
 * the quotation → invoice path works out of the box, before an admin creates
 * their own automations. It's harmless to call repeatedly.
 */
export async function ensureDefaultAutomations(): Promise<void> {
  const existing = await db.select({ id: automations.id }).from(automations).limit(1);
  if (existing.length > 0) return;

  const [automation] = await db
    .insert(automations)
    .values({
      name: "Convert Approved Quotations",
      description:
        "When a client approves a quotation, convert it into an invoice, email it, notify the client by WhatsApp and raise an internal notification.",
      trigger: "quotation.approved",
      conditions: JSON.stringify([{ field: "status", op: "eq", value: "accepted" }]),
      enabled: true,
    })
    .returning({ id: automations.id });

  const steps = [
    { action: "convertQuotationToInvoice", config: JSON.stringify({}) },
    { action: "sendEmail", config: JSON.stringify({ kind: "invoice", to: "{{clientEmail}}", entityId: "{{invoiceId}}" }) },
    { action: "sendWhatsApp", config: JSON.stringify({ kind: "invoice", to: "{{clientPhone}}", entityId: "{{invoiceId}}" }) },
    { action: "createNotification", config: JSON.stringify({ title: "Quotation converted", message: "Invoice {{invoiceNumber}} created from approved quotation {{number}}." }) },
  ];

  await db.insert(automationSteps).values(
    steps.map((s, i) => ({
      automationId: automation.id,
      action: s.action,
      config: s.config,
      sortOrder: i,
    }))
  );
}
