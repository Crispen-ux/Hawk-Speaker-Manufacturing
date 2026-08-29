"use server";

import { db } from "@/db";
import { deliveryNotes, deliveryNoteItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextDeliveryNoteNumber } from "@/lib/numbering";
import { logAudit } from "@/lib/audit";

type ItemInput = { description: string; quantity: string };

function parseItems(raw: string): ItemInput[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((it) => it && String(it.description ?? "").trim())
      .map((it) => ({
        description: String(it.description),
        quantity: String(it.quantity ?? "1"),
      }));
  } catch {
    return [];
  }
}

export async function createDeliveryNote(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const deliveryDate = String(formData.get("deliveryDate"));
  const relatedInvoiceId = Number(formData.get("relatedInvoiceId")) || null;
  const deliveredBy = String(formData.get("deliveredBy") ?? "") || null;
  const receivedBy = String(formData.get("receivedBy") ?? "") || null;
  const notes = String(formData.get("notes") ?? "") || null;
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (!clientId) throw new Error("Client is required");
  if (items.length === 0) throw new Error("Add at least one item");

  const number = await nextDeliveryNoteNumber();

  const [row] = await db
    .insert(deliveryNotes)
    .values({
      number,
      clientId,
      deliveryDate,
      relatedInvoiceId,
      deliveredBy,
      receivedBy,
      notes,
      status: "draft",
    })
    .returning({ id: deliveryNotes.id });

  await db.insert(deliveryNoteItems).values(
    items.map((it, i) => ({
      deliveryNoteId: row.id,
      description: it.description,
      quantity: it.quantity,
      sortOrder: i,
    }))
  );

  await logAudit({ documentKind: "deliveryNote", documentId: row.id, documentNumber: number, action: "created" });

  revalidatePath("/delivery-notes");
  redirect(`/delivery-notes/${row.id}`);
}

export async function updateDeliveryNote(id: number, formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const deliveryDate = String(formData.get("deliveryDate"));
  const relatedInvoiceId = Number(formData.get("relatedInvoiceId")) || null;
  const deliveredBy = String(formData.get("deliveredBy") ?? "") || null;
  const receivedBy = String(formData.get("receivedBy") ?? "") || null;
  const notes = String(formData.get("notes") ?? "") || null;
  const items = parseItems(String(formData.get("items") ?? "[]"));

  await db
    .update(deliveryNotes)
    .set({ clientId, deliveryDate, relatedInvoiceId, deliveredBy, receivedBy, notes })
    .where(eq(deliveryNotes.id, id));

  await db.delete(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, id));
  if (items.length > 0) {
    await db.insert(deliveryNoteItems).values(
      items.map((it, i) => ({
        deliveryNoteId: id,
        description: it.description,
        quantity: it.quantity,
        sortOrder: i,
      }))
    );
  }

  await logAudit({ documentKind: "deliveryNote", documentId: id, action: "updated" });

  revalidatePath("/delivery-notes");
  revalidatePath(`/delivery-notes/${id}`);
  redirect(`/delivery-notes/${id}`);
}

export async function setDeliveryNoteStatus(
  id: number,
  status: (typeof deliveryNotes.status.enumValues)[number]
) {
  await db.update(deliveryNotes).set({ status }).where(eq(deliveryNotes.id, id));
  await logAudit({ documentKind: "deliveryNote", documentId: id, action: "status_changed", detail: `→ ${status}` });
  revalidatePath("/delivery-notes");
  revalidatePath(`/delivery-notes/${id}`);
}

export async function deleteDeliveryNote(id: number) {
  const [row] = await db
    .select({ number: deliveryNotes.number })
    .from(deliveryNotes)
    .where(eq(deliveryNotes.id, id))
    .limit(1);
  if (row) await logAudit({ documentKind: "deliveryNote", documentId: id, documentNumber: row.number, action: "deleted" });
  await db.delete(deliveryNotes).where(eq(deliveryNotes.id, id));
  revalidatePath("/delivery-notes");
  redirect("/delivery-notes");
}
