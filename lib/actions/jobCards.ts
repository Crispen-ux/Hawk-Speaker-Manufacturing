"use server";

import { db } from "@/db";
import { jobCards, jobCardItems, invoices, invoiceItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextInvoiceNumber, nextJobCardNumber } from "@/lib/numbering";

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

export async function createJobCard(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "") || null;
  const technician = String(formData.get("technician") ?? "") || null;
  const equipment = String(formData.get("equipment") ?? "") || null;
  const openedDate = String(formData.get("openedDate"));
  const taxRate = String(formData.get("taxRate") ?? "0");
  const discount = String(formData.get("discount") ?? "0");
  const notes = String(formData.get("notes") ?? "") || null;
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (!clientId) throw new Error("Client is required");
  if (!title) throw new Error("Title is required");

  const number = await nextJobCardNumber();

  const [row] = await db
    .insert(jobCards)
    .values({
      number,
      clientId,
      title,
      description,
      technician,
      equipment,
      openedDate,
      taxRate,
      discount,
      notes,
      status: "open",
    })
    .returning({ id: jobCards.id });

  if (items.length > 0) {
    await db.insert(jobCardItems).values(
      items.map((it, i) => ({
        jobCardId: row.id,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        sortOrder: i,
      }))
    );
  }

  revalidatePath("/job-cards");
  redirect(`/job-cards/${row.id}`);
}

export async function updateJobCard(id: number, formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "") || null;
  const technician = String(formData.get("technician") ?? "") || null;
  const equipment = String(formData.get("equipment") ?? "") || null;
  const openedDate = String(formData.get("openedDate"));
  const completedDate = String(formData.get("completedDate") ?? "") || null;
  const taxRate = String(formData.get("taxRate") ?? "0");
  const discount = String(formData.get("discount") ?? "0");
  const notes = String(formData.get("notes") ?? "") || null;
  const items = parseItems(String(formData.get("items") ?? "[]"));

  await db
    .update(jobCards)
    .set({ clientId, title, description, technician, equipment, openedDate, completedDate, taxRate, discount, notes })
    .where(eq(jobCards.id, id));

  await db.delete(jobCardItems).where(eq(jobCardItems.jobCardId, id));
  if (items.length > 0) {
    await db.insert(jobCardItems).values(
      items.map((it, i) => ({
        jobCardId: id,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        sortOrder: i,
      }))
    );
  }

  revalidatePath("/job-cards");
  revalidatePath(`/job-cards/${id}`);
  redirect(`/job-cards/${id}`);
}

export async function setJobCardStatus(id: number, status: (typeof jobCards.status.enumValues)[number]) {
  const patch: { status: typeof status; completedDate?: string } = { status };
  if (status === "completed") {
    patch.completedDate = new Date().toISOString().slice(0, 10);
  }
  await db.update(jobCards).set(patch).where(eq(jobCards.id, id));
  revalidatePath("/job-cards");
  revalidatePath(`/job-cards/${id}`);
}

export async function deleteJobCard(id: number) {
  await db.delete(jobCards).where(eq(jobCards.id, id));
  revalidatePath("/job-cards");
  redirect("/job-cards");
}

export async function convertJobCardToInvoice(id: number) {
  const job = await db.query.jobCards.findFirst({
    where: eq(jobCards.id, id),
    with: { items: true },
  });
  if (!job) throw new Error("Job card not found");
  if (job.items.length === 0) throw new Error("Add at least one labour/parts line before invoicing");

  const number = await nextInvoiceNumber();
  const today = new Date();
  const due = new Date();
  due.setDate(due.getDate() + 14);

  const [inv] = await db
    .insert(invoices)
    .values({
      number,
      clientId: job.clientId,
      issueDate: today.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      taxRate: job.taxRate,
      discount: job.discount,
      notes: job.notes ?? `Job card ${job.number} — ${job.title}`,
      status: "draft",
    })
    .returning({ id: invoices.id });

  await db.insert(invoiceItems).values(
    job.items.map((it, i) => ({
      invoiceId: inv.id,
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      sortOrder: i,
    }))
  );

  await db
    .update(jobCards)
    .set({ status: "invoiced", convertedInvoiceId: inv.id })
    .where(eq(jobCards.id, id));

  revalidatePath("/job-cards");
  revalidatePath("/invoices");
  redirect(`/invoices/${inv.id}`);
}
