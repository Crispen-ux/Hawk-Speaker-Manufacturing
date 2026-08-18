"use server";

import { db } from "@/db";
import { recurringInvoices, recurringInvoiceItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateInvoiceFromRecurring } from "@/lib/recurring";

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

export async function createRecurring(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const frequency = String(formData.get("frequency") ?? "monthly") as
    | "weekly"
    | "monthly"
    | "quarterly"
    | "yearly";
  const dueInDays = Number(formData.get("dueInDays") ?? 14);
  const taxRate = String(formData.get("taxRate") ?? "0");
  const discount = String(formData.get("discount") ?? "0");
  const notes = String(formData.get("notes") ?? "") || null;
  const nextRunDate = String(formData.get("nextRunDate"));
  const autoSend = formData.get("autoSend") === "on";
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (!clientId) throw new Error("Client is required");
  if (items.length === 0) throw new Error("Add at least one line item");

  const [row] = await db
    .insert(recurringInvoices)
    .values({
      clientId,
      frequency,
      dueInDays,
      taxRate,
      discount,
      notes,
      nextRunDate,
      autoSend,
      active: true,
    })
    .returning({ id: recurringInvoices.id });

  await db.insert(recurringInvoiceItems).values(
    items.map((it, i) => ({
      recurringInvoiceId: row.id,
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      sortOrder: i,
    }))
  );

  revalidatePath("/recurring");
  redirect(`/recurring/${row.id}`);
}

export async function updateRecurring(id: number, formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const frequency = String(formData.get("frequency") ?? "monthly") as
    | "weekly"
    | "monthly"
    | "quarterly"
    | "yearly";
  const dueInDays = Number(formData.get("dueInDays") ?? 14);
  const taxRate = String(formData.get("taxRate") ?? "0");
  const discount = String(formData.get("discount") ?? "0");
  const notes = String(formData.get("notes") ?? "") || null;
  const nextRunDate = String(formData.get("nextRunDate"));
  const autoSend = formData.get("autoSend") === "on";
  const items = parseItems(String(formData.get("items") ?? "[]"));

  await db
    .update(recurringInvoices)
    .set({ clientId, frequency, dueInDays, taxRate, discount, notes, nextRunDate, autoSend })
    .where(eq(recurringInvoices.id, id));

  await db.delete(recurringInvoiceItems).where(eq(recurringInvoiceItems.recurringInvoiceId, id));
  if (items.length > 0) {
    await db.insert(recurringInvoiceItems).values(
      items.map((it, i) => ({
        recurringInvoiceId: id,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        sortOrder: i,
      }))
    );
  }

  revalidatePath("/recurring");
  revalidatePath(`/recurring/${id}`);
  redirect(`/recurring/${id}`);
}

export async function toggleRecurringActive(id: number, active: boolean) {
  await db.update(recurringInvoices).set({ active }).where(eq(recurringInvoices.id, id));
  revalidatePath("/recurring");
  revalidatePath(`/recurring/${id}`);
}

export async function deleteRecurring(id: number) {
  await db.delete(recurringInvoices).where(eq(recurringInvoices.id, id));
  revalidatePath("/recurring");
  redirect("/recurring");
}

export async function generateNow(id: number) {
  const { invoiceId } = await generateInvoiceFromRecurring(id);
  revalidatePath("/recurring");
  revalidatePath(`/recurring/${id}`);
  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}
