"use server";

import { db } from "@/db";
import { invoices, invoiceItems, payments, receipts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextInvoiceNumber, nextReceiptNumber } from "@/lib/numbering";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/actions/notifications";
import { flashUrl } from "@/lib/flash";
import { calcTotals, toNumber } from "@/lib/money";
import { postInvoiceIssued, postPaymentReceived } from "@/lib/accounting/posting";

type ItemInput = { description: string; quantity: string; unitPrice: string; vatTreatment: "standard" | "zero_rated" | "exempt" };
function parseItems(raw: string): ItemInput[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((it) => it && String(it.description ?? "").trim()).map((it) => ({ description: String(it.description), quantity: String(it.quantity ?? "1"), unitPrice: String(it.unitPrice ?? "0"), vatTreatment: (it.vatTreatment === "zero_rated" || it.vatTreatment === "exempt" ? it.vatTreatment : "standard") }));
  } catch { return []; }
}

export async function createInvoice(formData: FormData) {
  const clientId = Number(formData.get("clientId")); const issueDate = String(formData.get("issueDate")); const dueDate = String(formData.get("dueDate"));
  const taxRate = String(formData.get("taxRate") ?? "0"); const discount = String(formData.get("discount") ?? "0");
  const notes = String(formData.get("notes") ?? "") || null; const paymentTerms = String(formData.get("paymentTerms") ?? "") || null; const items = parseItems(String(formData.get("items") ?? "[]"));
  if (!clientId) throw new Error("Client is required"); if (!items.length) throw new Error("Add at least one line item");
  const number = await nextInvoiceNumber();
  const [row] = await db.insert(invoices).values({ number, clientId, issueDate, dueDate, taxRate, discount, notes, paymentTerms, status: "draft" }).returning({ id: invoices.id });
  await db.insert(invoiceItems).values(items.map((it, i) => ({ invoiceId: row.id, description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, vatTreatment: it.vatTreatment, sortOrder: i })));
  await logAudit({ documentKind: "invoice", documentId: row.id, documentNumber: number, action: "created" });
  revalidatePath("/invoices"); redirect(flashUrl(`/invoices/${row.id}`, "Invoice created"));
}

export async function updateInvoice(id: number, formData: FormData) {
  const [existing] = await db.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!existing) throw new Error("Invoice not found");
  if (existing.status !== "draft") throw new Error("Issued invoices are locked. Correct them with a credit note and replacement invoice.");
  const clientId = Number(formData.get("clientId")); const issueDate = String(formData.get("issueDate")); const dueDate = String(formData.get("dueDate"));
  const taxRate = String(formData.get("taxRate") ?? "0"); const discount = String(formData.get("discount") ?? "0");
  const notes = String(formData.get("notes") ?? "") || null; const paymentTerms = String(formData.get("paymentTerms") ?? "") || null; const items = parseItems(String(formData.get("items") ?? "[]"));
  if (!clientId || !issueDate || !dueDate || !items.length) throw new Error("Client, dates and at least one line item are required");
  await db.update(invoices).set({ clientId, issueDate, dueDate, taxRate, discount, notes, paymentTerms }).where(eq(invoices.id, id));
  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  await db.insert(invoiceItems).values(items.map((it, i) => ({ invoiceId: id, description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, vatTreatment: it.vatTreatment, sortOrder: i })));
  await logAudit({ documentKind: "invoice", documentId: id, action: "updated" });
  revalidatePath("/invoices"); revalidatePath(`/invoices/${id}`); redirect(flashUrl(`/invoices/${id}`, "Invoice updated"));
}

export async function setInvoiceStatus(id: number, status: (typeof invoices.status.enumValues)[number]) {
  const [invoice] = await db.query.invoices.findMany({ where: eq(invoices.id, id), with: { items: true } });
  if (!invoice) throw new Error("Invoice not found");
  const wasDraft = invoice.status === "draft";
  if (invoice.status !== "draft" && status === "draft") throw new Error("Issued invoices cannot return to draft");
  if (wasDraft && status !== "draft" && status !== "cancelled") {
    const totals = calcTotals(invoice.items, invoice.taxRate, invoice.discount);
    await postInvoiceIssued({ invoiceId: invoice.id, invoiceNumber: invoice.number, date: invoice.issueDate, subtotal: totals.subtotal - totals.discount, tax: totals.tax });
  }
  await db.update(invoices).set({ status }).where(eq(invoices.id, id));
  await logAudit({ documentKind: "invoice", documentId: id, action: "status_changed", detail: `→ ${status}` });
  revalidatePath("/invoices"); revalidatePath(`/invoices/${id}`); revalidatePath("/accounting/control"); revalidatePath("/accounting/trial-balance"); revalidatePath("/accounting/income-statement"); revalidatePath("/accounting/balance-sheet"); revalidatePath("/");
}

export async function deleteInvoice(id: number) {
  const [row] = await db.select({ number: invoices.number, status: invoices.status }).from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!row) return;
  if (row.status !== "draft") throw new Error("Issued invoices cannot be deleted. Use a credit note to reverse them.");
  await logAudit({ documentKind: "invoice", documentId: id, documentNumber: row.number, action: "deleted" });
  await db.delete(invoices).where(eq(invoices.id, id));
  revalidatePath("/invoices"); redirect(flashUrl(`/invoices`, "Invoice deleted"));
}

export async function addPayment(invoiceId: number, formData: FormData) {
  await recordInvoicePayment(invoiceId, { amount: String(formData.get("amount") ?? "0"), date: String(formData.get("date")), method: String(formData.get("method") ?? "") || null, note: String(formData.get("note") ?? "") || null });
}

export async function recordInvoicePayment(invoiceId: number, data: { amount: string; date: string; method?: string | null; note?: string | null }) {
  const amount = toNumber(data.amount); if (amount <= 0) throw new Error("Payment must be greater than zero");
  const [invoice] = await db.select({ number: invoices.number, clientId: invoices.clientId, status: invoices.status }).from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!invoice) throw new Error("Invoice not found"); if (invoice.status === "draft" || invoice.status === "cancelled") throw new Error("Only issued invoices can receive payments");
  const [payment] = await db.insert(payments).values({ invoiceId, amount: amount.toFixed(2), date: data.date, method: data.method ?? null, note: data.note ?? null }).returning({ id: payments.id });
  await postPaymentReceived({ paymentId: payment.id, invoiceNumber: invoice.number, date: data.date, amount });
  const number = await nextReceiptNumber();
  const [receipt] = await db.insert(receipts).values({ number, paymentId: payment.id, invoiceId, clientId: invoice.clientId, issueDate: data.date, amount: amount.toFixed(2), method: data.method ?? null, note: data.note ?? null }).returning({ id: receipts.id });
  await logAudit({ documentKind: "invoice", documentId: invoiceId, documentNumber: invoice.number, action: "payment_recorded", detail: `${amount.toFixed(2)} received` });
  await logAudit({ documentKind: "receipt", documentId: receipt.id, documentNumber: number, action: "receipt_issued", detail: `for invoice ${invoice.number}` });
  void notify({ title: `Payment of ${amount.toFixed(2)} received`, message: `For invoice ${invoice.number}`, documentKind: "receipt", documentId: receipt.id, level: "success" });
  revalidatePath(`/invoices/${invoiceId}`); revalidatePath("/invoices"); revalidatePath("/receipts"); revalidatePath("/payments"); revalidatePath("/accounting/control"); revalidatePath("/accounting/trial-balance"); revalidatePath("/accounting/balance-sheet"); revalidatePath("/");
}

export async function deletePayment(_paymentId: number, _invoiceId: number) {
  throw new Error("Payments are immutable financial records. Record a refund/reversal instead of deleting the payment.");
}
