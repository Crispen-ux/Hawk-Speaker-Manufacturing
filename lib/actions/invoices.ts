"use server";

import { db } from "@/db";
import { invoices, invoiceItems, payments, receipts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextInvoiceNumber, nextReceiptNumber } from "@/lib/numbering";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/actions/notifications";

type ItemInput = { description: string; quantity: string; unitPrice: string };

function parseItems(raw: string): ItemInput[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((it) => it && String(it.description ?? "").trim())
      .map((it) => ({
        description: String(it.description),
        quantity: String(it.quantity ?? "1"),
        unitPrice: String(it.unitPrice ?? "0"),
      }));
  } catch {
    return [];
  }
}

export async function createInvoice(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const issueDate = String(formData.get("issueDate"));
  const dueDate = String(formData.get("dueDate"));
  const taxRate = String(formData.get("taxRate") ?? "0");
  const discount = String(formData.get("discount") ?? "0");
  const notes = String(formData.get("notes") ?? "") || null;
  const paymentTerms = String(formData.get("paymentTerms") ?? "") || null;
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (!clientId) throw new Error("Client is required");
  if (items.length === 0) throw new Error("Add at least one line item");

  const number = await nextInvoiceNumber();

  const [row] = await db
    .insert(invoices)
    .values({ number, clientId, issueDate, dueDate, taxRate, discount, notes, paymentTerms, status: "draft" })
    .returning({ id: invoices.id });

  await db.insert(invoiceItems).values(
    items.map((it, i) => ({
      invoiceId: row.id,
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      sortOrder: i,
    }))
  );

  await logAudit({ documentKind: "invoice", documentId: row.id, documentNumber: number, action: "created" });

  revalidatePath("/invoices");
  redirect(`/invoices/${row.id}`);
}

export async function updateInvoice(id: number, formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const issueDate = String(formData.get("issueDate"));
  const dueDate = String(formData.get("dueDate"));
  const taxRate = String(formData.get("taxRate") ?? "0");
  const discount = String(formData.get("discount") ?? "0");
  const notes = String(formData.get("notes") ?? "") || null;
  const paymentTerms = String(formData.get("paymentTerms") ?? "") || null;
  const items = parseItems(String(formData.get("items") ?? "[]"));

  await db
    .update(invoices)
    .set({ clientId, issueDate, dueDate, taxRate, discount, notes, paymentTerms })
    .where(eq(invoices.id, id));

  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  if (items.length > 0) {
    await db.insert(invoiceItems).values(
      items.map((it, i) => ({
        invoiceId: id,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        sortOrder: i,
      }))
    );
  }

  await logAudit({ documentKind: "invoice", documentId: id, action: "updated" });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}`);
}

export async function setInvoiceStatus(id: number, status: (typeof invoices.status.enumValues)[number]) {
  await db.update(invoices).set({ status }).where(eq(invoices.id, id));
  await logAudit({ documentKind: "invoice", documentId: id, action: "status_changed", detail: `→ ${status}` });
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/");
}

export async function deleteInvoice(id: number) {
  const [row] = await db
    .select({ number: invoices.number })
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (row) await logAudit({ documentKind: "invoice", documentId: id, documentNumber: row.number, action: "deleted" });
  await db.delete(invoices).where(eq(invoices.id, id));
  revalidatePath("/invoices");
  redirect("/invoices");
}

export async function addPayment(invoiceId: number, formData: FormData) {
  await recordInvoicePayment(invoiceId, {
    amount: String(formData.get("amount") ?? "0"),
    date: String(formData.get("date")),
    method: String(formData.get("method") ?? "") || null,
    note: String(formData.get("note") ?? "") || null,
  });
}

/** Shared payment path — used by the invoice detail form and the standalone payments area. */
export async function recordInvoicePayment(
  invoiceId: number,
  data: { amount: string; date: string; method?: string | null; note?: string | null }
) {
  const amount = data.amount;
  const date = data.date;
  const method = data.method ?? null;
  const note = data.note ?? null;

  const [invoice] = await db
    .select({ number: invoices.number, clientId: invoices.clientId })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!invoice) throw new Error("Invoice not found");

  const [payment] = await db
    .insert(payments)
    .values({ invoiceId, amount, date, method, note })
    .returning({ id: payments.id });

  // Every recorded payment mints a numbered receipt.
  const number = await nextReceiptNumber();
  const [receipt] = await db
    .insert(receipts)
    .values({
      number,
      paymentId: payment.id,
      invoiceId,
      clientId: invoice.clientId,
      issueDate: date,
      amount,
      method,
      note,
    })
    .returning({ id: receipts.id });

  await logAudit({ documentKind: "invoice", documentId: invoiceId, documentNumber: invoice.number, action: "payment_recorded", detail: `${amount} received` });
  await logAudit({ documentKind: "receipt", documentId: receipt.id, documentNumber: number, action: "receipt_issued", detail: `for invoice ${invoice.number}` });

  void notify({
    title: `Payment of ${amount} received`,
    message: `For invoice ${invoice.number}`,
    documentKind: "receipt",
    documentId: receipt.id,
    level: "success",
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/receipts");
  revalidatePath("/payments");
  revalidatePath("/");
}

export async function deletePayment(paymentId: number, invoiceId: number) {
  const [payment] = await db
    .select({ amount: payments.amount })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);
  await db.delete(payments).where(eq(payments.id, paymentId)); // cascades to the attached receipt
  await logAudit({
    documentKind: "invoice",
    documentId: invoiceId,
    action: "payment_deleted",
    detail: payment ? `${payment.amount} removed` : undefined,
  });
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/receipts");
  revalidatePath("/payments");
  revalidatePath("/");
}
