import { db } from "@/db";
import { quotations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/actions/notifications";
import { emit } from "@/lib/events";

/**
 * QuotationService — the decision layer for quotations. Both the client portal
 * and the internal app call these; the service is the single place that
 * records the decision (status + timestamps), audits it, notifies internal
 * users, and emits the domain event that the automation engine reacts to.
 *
 * Approval/decline is idempotent: a quotation can only be decided once.
 */

export type QuotationDecisionOpts = {
  actorId?: string;
  comment?: string;
  /* When provided, verifies the quotation belongs to this client (tenant
     isolation for portal access). */
  clientId?: number;
};

async function assertQuotationAccess(quotationId: number, clientId?: number) {
  const quote = await db.query.quotations.findFirst({ where: eq(quotations.id, quotationId) });
  if (!quote) throw new Error("Quotation not found");
  if (clientId !== undefined && quote.clientId !== clientId) {
    throw new Error("Quotation not found");
  }
  return quote;
}

/**
 * Approves a quotation. Returns { approved: true, existing: true } when the
 * quotation was already approved, so callers don't double-fire events.
 */
export async function approveQuotation(
  quotationId: number,
  opts: QuotationDecisionOpts = {}
): Promise<{ approved: boolean; existing: boolean; quotationId: number }> {
  const quote = await assertQuotationAccess(quotationId, opts.clientId);

  // Idempotency: already approved (accepted / has a converted invoice).
  if (quote.status === "accepted" || quote.convertedInvoiceId) {
    return { approved: true, existing: true, quotationId };
  }
  // Can't approve something that's been declined.
  if (quote.status === "declined") {
    throw new Error("This quotation has already been declined.");
  }

  const now = new Date();
  await db
    .update(quotations)
    .set({ status: "accepted", approvedAt: now })
    .where(eq(quotations.id, quotationId));

  await logAudit({
    documentKind: "quotation",
    documentId: quotationId,
    documentNumber: quote.number,
    action: "approved",
    detail: [opts.comment, opts.actorId ? `by ${opts.actorId}` : ""].filter(Boolean).join(" · ") || undefined,
  });
  await notify({
    title: "Quotation approved",
    message: `Quotation ${quote.number} was approved${opts.comment ? ` — ${opts.comment}` : ""}.`,
    documentKind: "quotation",
    documentId: quotationId,
    level: "success",
  });

  // The event that drives the "Convert Approved Quotations" workflow.
  await emit("quotation.approved", {
    entityType: "quotation",
    entityId: quotationId,
    entityNumber: quote.number,
    actorId: opts.actorId,
    data: {
      clientId: quote.clientId,
      status: "accepted",
      amount: opts.comment,
      comment: opts.comment,
    },
  });

  return { approved: true, existing: false, quotationId };
}

/**
 * Declines a quotation, storing the reason. Never produces an invoice, and is
 * idempotent (a declined quotation can't be declined again or re-approved).
 */
export async function declineQuotation(
  quotationId: number,
  opts: QuotationDecisionOpts & { reason?: string } = {}
): Promise<{ declined: boolean; existing: boolean; quotationId: number }> {
  const quote = await assertQuotationAccess(quotationId, opts.clientId);

  if (quote.status === "declined") {
    return { declined: true, existing: true, quotationId };
  }
  if (quote.status === "accepted" || quote.convertedInvoiceId) {
    throw new Error("This quotation has already been approved.");
  }

  const now = new Date();
  await db
    .update(quotations)
    .set({ status: "declined", declinedAt: now, declineReason: opts.reason ?? null })
    .where(eq(quotations.id, quotationId));

  await logAudit({
    documentKind: "quotation",
    documentId: quotationId,
    documentNumber: quote.number,
    action: "declined",
    detail: [opts.reason, opts.actorId ? `by ${opts.actorId}` : ""].filter(Boolean).join(" · ") || undefined,
  });
  await notify({
    title: "Quotation declined",
    message: `Quotation ${quote.number} was declined${opts.reason ? ` — ${opts.reason}` : ""}.`,
    documentKind: "quotation",
    documentId: quotationId,
    level: "warning",
  });

  await emit("quotation.declined", {
    entityType: "quotation",
    entityId: quotationId,
    entityNumber: quote.number,
    actorId: opts.actorId,
    data: { clientId: quote.clientId, reason: opts.reason ?? "" },
  });

  return { declined: true, existing: false, quotationId };
}
