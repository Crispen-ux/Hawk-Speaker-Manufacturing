import { db } from "@/db";
import { quotations, quotationItems, invoices, invoiceItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nextInvoiceNumber } from "@/lib/numbering";
import { logAudit } from "@/lib/audit";
import { emit } from "@/lib/events";

/**
 * InvoiceService — reusable invoice operations used by both the internal
 * "convert to invoice" action and the automation engine. Keeping the real work
 * here (rather than inside a server action) lets multiples callers share it.
 */

export type ConvertResult = {
  invoiceId: number;
  invoiceNumber: string;
  existing: boolean;
};

function dueDateFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Converts an approved quotation into an invoice.
 *
 * Idempotent by design: calling this twice for the same quotation returns the
 * already-created invoice and never duplicates it. The quote's
 * `convertedInvoiceId` is the guard; it's set in the same operation that
 * creates the invoice so a retry can't slip a second invoice in.
 */
export async function convertQuotationToInvoice(
  quotationId: number,
  opts: {
    actorId?: string;
    // Status to give the created invoice (defaults to "sent" so it can be
    // delivered; callers may override).
    status?: "draft" | "sent";
  } = {}
): Promise<ConvertResult> {
  const quote = await db.query.quotations.findFirst({
    where: eq(quotations.id, quotationId),
    with: { items: true },
  });
  if (!quote) throw new Error("Quotation not found");

  // Idempotency guard — never create a duplicate invoice for the same quote.
  if (quote.convertedInvoiceId) {
    const existing = await db.query.invoices.findFirst({
      where: eq(invoices.id, quote.convertedInvoiceId),
    });
    if (existing) {
      return { invoiceId: existing.id, invoiceNumber: existing.number, existing: true };
    }
  }

  const number = await nextInvoiceNumber();
  const today = new Date().toISOString().slice(0, 10);

  const [inv] = await db
    .insert(invoices)
    .values({
      number,
      clientId: quote.clientId,
      issueDate: today,
      dueDate: dueDateFromNow(14),
      taxRate: quote.taxRate,
      discount: quote.discount,
      notes: quote.notes,
      paymentTerms: quote.paymentTerms,
      status: opts.status ?? "sent",
      sourceQuotationId: quote.id,
    })
    .returning({ id: invoices.id });

  if (quote.items.length > 0) {
    await db.insert(invoiceItems).values(
      quote.items.map((it, i) => ({
        invoiceId: inv.id,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        sortOrder: i,
      }))
    );
  }

  await db
    .update(quotations)
    .set({
      status: "accepted",
      convertedInvoiceId: inv.id,
      approvedAt: quote.approvedAt ?? new Date(),
    })
    .where(eq(quotations.id, quotationId));

  await logAudit({
    documentKind: "quotation",
    documentId: quotationId,
    documentNumber: quote.number,
    action: "converted",
    detail: `invoice ${number}${opts.actorId ? ` · by ${opts.actorId}` : ""}`,
  });

  // Let other automations react to the freshly-created invoice (e.g. sends).
  await emit("invoice.created", {
    entityType: "invoice",
    entityId: inv.id,
    entityNumber: number,
    actorId: opts.actorId,
    data: { clientId: quote.clientId, sourceQuotationId: quotationId },
  });

  return { invoiceId: inv.id, invoiceNumber: number, existing: false };
}
