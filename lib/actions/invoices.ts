"use server";

import { db } from "@/db";
import { invoices, invoiceItems, payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextInvoiceNumber } from "@/lib/numbering";

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
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (!clientId) throw new Error("Client is required");
  if (items.length === 0) throw new Error("Add at least one line item");

  const number = await nextInvoiceNumber();

  const [row] = await db
    .insert(invoices)
    .values({ number, clientId, issueDate, dueDate, taxRate, discount, notes, status: "draft" })
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
  const items = parseItems(String(formData.get("items") ?? "[]"));

  await db
    .update(invoices)
    .set({ clientId, issueDate, dueDate, taxRate, discount, notes })
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

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}`);
}

export async function setInvoiceStatus(id: number, status: (typeof invoices.status.enumValues)[number]) {
  await db.update(invoices).set({ status }).where(eq(invoices.id, id));
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/");
}

export async function deleteInvoice(id: number) {
  await db.delete(invoices).where(eq(invoices.id, id));
  revalidatePath("/invoices");
  redirect("/invoices");
}

export async function addPayment(invoiceId: number, formData: FormData) {
  const amount = String(formData.get("amount") ?? "0");
  const date = String(formData.get("date"));
  const method = String(formData.get("method") ?? "") || null;
  const note = String(formData.get("note") ?? "") || null;

  await db.insert(payments).values({ invoiceId, amount, date, method, note });
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/");
}

export async function deletePayment(paymentId: number, invoiceId: number) {
  await db.delete(payments).where(eq(payments.id, paymentId));
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/");
}
