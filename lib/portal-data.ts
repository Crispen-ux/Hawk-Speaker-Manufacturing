import { db } from "@/db";
import {
  invoices,
  quotations,
  receipts,
  creditNotes,
  deliveryNotes,
  payments,
} from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { calcTotals, toNumber } from "@/lib/money";

/**
 * Client-scoped read helpers for the portal. Every query is bounded by
 * clientId — the tenant/isolation boundary — so clients only ever see their
 * own data and nothing belonging to other clients.
 */

export type PortalInvoice = {
  id: number;
  number: string;
  total: number;
  balance: number;
  status: string;
  issueDate: string;
  dueDate: string;
  clientId: number;
};

export type PortalQuotation = {
  id: number;
  number: string;
  total: number;
  status: string;
  issueDate: string;
  expiryDate: string;
  convertedInvoiceId: number | null;
};

/** The client's account position (outstanding + overdue across invoices and credit notes). */
export async function getPortalBalances(clientId: number): Promise<{ outstanding: number; overdue: number }> {
  const invRows = await db.query.invoices.findMany({
    where: eq(invoices.clientId, clientId),
    with: { items: true, payments: true },
  });

  const today = new Date().toISOString().slice(0, 10);
  let outstanding = 0;
  let overdue = 0;
  for (const inv of invRows) {
    if (inv.status === "cancelled") continue;
    const { total } = calcTotals(inv.items, inv.taxRate, inv.discount);
    const paid = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
    const balance = Math.max(total - paid, 0);
    outstanding += balance;
    if (balance > 0 && inv.dueDate < today) overdue += balance;
  }

  const cnRows = await db.query.creditNotes.findMany({
    where: eq(creditNotes.clientId, clientId),
    with: { items: true },
  });
  for (const cn of cnRows) {
    if (cn.status === "cancelled") continue;
    const { total } = calcTotals(cn.items, cn.taxRate, cn.discount);
    outstanding = Math.max(outstanding - total, 0);
  }

  return { outstanding, overdue };
}

export async function getPortalInvoices(clientId: number): Promise<PortalInvoice[]> {
  const invRows = await db.query.invoices.findMany({
    where: eq(invoices.clientId, clientId),
    with: { items: true, payments: true },
    orderBy: (t, { desc }) => [desc(t.issueDate)],
  });
  return invRows.map((inv) => {
    const { total } = calcTotals(inv.items, inv.taxRate, inv.discount);
    const paid = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
    return {
      id: inv.id,
      number: inv.number,
      total,
      balance: Math.max(total - paid, 0),
      status: inv.status,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      clientId: inv.clientId,
    };
  });
}

export async function getPortalQuotations(clientId: number): Promise<PortalQuotation[]> {
  const qRows = await db.query.quotations.findMany({
    where: eq(quotations.clientId, clientId),
    with: { items: true },
    orderBy: (t, { desc }) => [desc(t.issueDate)],
  });
  return qRows.map((q) => ({
    id: q.id,
    number: q.number,
    total: calcTotals(q.items, q.taxRate, q.discount).total,
    status: q.status,
    issueDate: q.issueDate,
    expiryDate: q.expiryDate,
    convertedInvoiceId: q.convertedInvoiceId,
  }));
}

export async function getPortalReceipts(clientId: number) {
  const rows = await db.query.receipts.findMany({
    where: eq(receipts.clientId, clientId),
    orderBy: (t, { desc }) => [desc(t.issueDate)],
  });
  return rows.map((r) => ({ id: r.id, number: r.number, amount: toNumber(r.amount), issueDate: r.issueDate, method: r.method, invoiceId: r.invoiceId }));
}

export async function getPortalCreditNotes(clientId: number) {
  const rows = await db.query.creditNotes.findMany({
    where: eq(creditNotes.clientId, clientId),
    with: { items: true },
    orderBy: (t, { desc }) => [desc(t.issueDate)],
  });
  return rows.map((cn) => ({
    id: cn.id,
    number: cn.number,
    total: calcTotals(cn.items, cn.taxRate, cn.discount).total,
    status: cn.status,
    issueDate: cn.issueDate,
  }));
}

export async function getPortalDeliveryNotes(clientId: number) {
  const rows = await db.query.deliveryNotes.findMany({
    where: eq(deliveryNotes.clientId, clientId),
    orderBy: (t, { desc }) => [desc(t.deliveryDate)],
  });
  return rows.map((d) => ({ id: d.id, number: d.number, deliveryDate: d.deliveryDate, status: d.status }));
}

export async function getPortalPayments(clientId: number) {
  const rows = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      date: payments.date,
      method: payments.method,
      note: payments.note,
      invoiceId: payments.invoiceId,
      invoiceNumber: invoices.number,
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(eq(invoices.clientId, clientId))
    .orderBy(desc(payments.date));
  return rows;
}

/**
 * The client's notification feed. Notifications are created without a client
 * id, so we resolve each one's owning client through its document reference
 * and drop anything that isn't tied to a document this client owns. This keeps
 * internal alerts (employee, expense, stock, automation, …) out of the portal.
 */
export async function getPortalNotifications(clientId: number, limit = 50) {
  const { notifications } = await import("@/db/schema");
  const rows = await db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(200);

  const byKind = new Map<string, number[]>();
  for (const n of rows) {
    if (n.documentKind && n.documentId && CLIENT_DOC_KINDS.includes(n.documentKind as (typeof CLIENT_DOC_KINDS)[number])) {
      const list = byKind.get(n.documentKind) ?? [];
      list.push(n.documentId);
      byKind.set(n.documentKind, list);
    }
  }

  const owned = new Set<string>();
  for (const [kind, ids] of byKind) {
    const table = CLIENT_DOC_OWNER[kind as keyof typeof CLIENT_DOC_OWNER];
    if (!table) continue;
    const matches = await db.select({ id: table.id, clientId: table.clientId }).from(table).where(and(inArray(table.id, ids), eq(table.clientId, clientId)));
    for (const m of matches) owned.add(`${kind}:${m.id}`);
  }

  return rows
    .filter((n) => (n.documentKind && n.documentId ? owned.has(`${n.documentKind}:${n.documentId}`) : false))
    .slice(0, limit)
    .map((n) => ({ id: n.id, title: n.title, message: n.message, level: n.level, read: n.read, createdAt: n.createdAt, documentKind: n.documentKind, documentId: n.documentId }));
}

const CLIENT_DOC_KINDS = ["invoice", "quotation", "receipt", "creditNote", "deliveryNote"] as const;

const CLIENT_DOC_OWNER = {
  invoice: invoices,
  quotation: quotations,
  receipt: receipts,
  creditNote: creditNotes,
  deliveryNote: deliveryNotes,
};