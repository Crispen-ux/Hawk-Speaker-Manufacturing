import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export type AuditEntry = {
  documentKind: string;
  documentId: number;
  documentNumber?: string | null;
  action: string;
  detail?: string | null;
};

/**
 * Append-only audit trail. Every important action against a document (created,
 * edited, status changed, sent, payment recorded, converted, deleted…)
 * should call `logAudit`. Errors are deliberately swallowed so a failed audit
 * write can never roll back the business operation that triggered it.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      documentKind: entry.documentKind,
      documentId: entry.documentId,
      documentNumber: entry.documentNumber ?? null,
      action: entry.action,
      detail: entry.detail ?? null,
    });
  } catch {
    // Audit is best-effort.
  }
}

/** Newest-first history for one document. */
export async function getAuditForDocument(documentKind: string, documentId: number, limit = 50) {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      detail: auditLogs.detail,
      documentNumber: auditLogs.documentNumber,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(and(eq(auditLogs.documentKind, documentKind), eq(auditLogs.documentId, documentId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export type AuditLogRow = {
  id: number;
  documentKind: string;
  documentId: number;
  documentNumber: string | null;
  action: string;
  detail: string | null;
  createdAt: Date;
};

/** Newest-first history across the whole system (for the global audit page). */
export async function getAuditLog(limit = 200): Promise<AuditLogRow[]> {
  return db
    .select({
      id: auditLogs.id,
      documentKind: auditLogs.documentKind,
      documentId: auditLogs.documentId,
      documentNumber: auditLogs.documentNumber,
      action: auditLogs.action,
      detail: auditLogs.detail,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

/** Friendly, short descriptions for audit actions. */
export function describeAction(action: string): string {
  const map: Record<string, string> = {
    created: "Created",
    updated: "Updated",
    status_changed: "Status changed",
    sent_email: "Sent by email",
    sent_whatsapp: "Sent by WhatsApp",
    reminder_sent: "Payment reminder sent",
    payment_recorded: "Payment recorded",
    receipt_issued: "Receipt issued",
    payment_deleted: "Payment removed",
    deleted: "Deleted",
    converted: "Converted to invoice",
    credit_note_created: "Credit note created",
    credit_note_issued: "Credit note issued",
  };
  return map[action] ?? action.replace(/_/g, " ");
}

const KIND_LABELS: Record<string, string> = {
  invoice: "Invoice",
  quotation: "Quotation",
  creditNote: "Credit note",
  receipt: "Receipt",
  purchaseOrder: "Purchase order",
  jobCard: "Job card",
  deliveryNote: "Delivery note",
  statement: "Statement",
};

export function describeKind(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

/** Route to a document's detail page, for the global audit log links. */
export function routeForDocument(kind: string, documentId: number): string {
  const routes: Record<string, string> = {
    invoice: "/invoices",
    quotation: "/quotations",
    creditNote: "/credit-notes",
    receipt: "/receipts",
    purchaseOrder: "/purchase-orders",
    jobCard: "/job-cards",
    deliveryNote: "/delivery-notes",
    statement: "/statements",
    expense: "/expenses",
    asset: "/assets",
    employee: "/employees",
  };
  const base = routes[kind];
  if (!base || documentId <= 0) return base ?? "/";
  return `${base}/${documentId}`;
}