"use server";

import { db } from "@/db";
import { quotations, quotationItems, invoices, invoiceItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextInvoiceNumber, nextQuotationNumber } from "@/lib/numbering";
import { logAudit } from "@/lib/audit";
import { logClientActivity } from "@/lib/activity";
import { flashUrl } from "@/lib/flash";

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

export async function createQuotation(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const issueDate = String(formData.get("issueDate"));
  const expiryDate = String(formData.get("expiryDate"));
  const taxRate = String(formData.get("taxRate") ?? "0");
  const discount = String(formData.get("discount") ?? "0");
  const notes = String(formData.get("notes") ?? "") || null;
  const paymentTerms = String(formData.get("paymentTerms") ?? "") || null;
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (!clientId) throw new Error("Client is required");
  if (items.length === 0) throw new Error("Add at least one line item");

  const number = await nextQuotationNumber();

  const [row] = await db
    .insert(quotations)
    .values({ number, clientId, issueDate, expiryDate, taxRate, discount, notes, paymentTerms, status: "draft" })
    .returning({ id: quotations.id });

  await db.insert(quotationItems).values(
    items.map((it, i) => ({
      quotationId: row.id,
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      sortOrder: i,
    }))
  );

  await logAudit({ documentKind: "quotation", documentId: row.id, documentNumber: number, action: "created" });

  revalidatePath("/quotations");
  redirect(flashUrl(`/quotations/${row.id}` , "Quotation created"));
}

export async function updateQuotation(id: number, formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const issueDate = String(formData.get("issueDate"));
  const expiryDate = String(formData.get("expiryDate"));
  const taxRate = String(formData.get("taxRate") ?? "0");
  const discount = String(formData.get("discount") ?? "0");
  const notes = String(formData.get("notes") ?? "") || null;
  const paymentTerms = String(formData.get("paymentTerms") ?? "") || null;
  const items = parseItems(String(formData.get("items") ?? "[]"));

  await db
    .update(quotations)
    .set({ clientId, issueDate, expiryDate, taxRate, discount, notes, paymentTerms })
    .where(eq(quotations.id, id));

  await db.delete(quotationItems).where(eq(quotationItems.quotationId, id));
  if (items.length > 0) {
    await db.insert(quotationItems).values(
      items.map((it, i) => ({
        quotationId: id,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        sortOrder: i,
      }))
    );
  }

  await logAudit({ documentKind: "quotation", documentId: id, action: "updated" });

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  redirect(flashUrl(`/quotations/${id}` , "Quotation updated"));
}

export async function setQuotationStatus(
  id: number,
  status: (typeof quotations.status.enumValues)[number]
) {
  if (status === "accepted") {
    const [q] = await db.select().from(quotations).where(eq(quotations.id, id));
    if (q) {
      void logClientActivity({
        clientId: q.clientId,
        type: "follow_up",
        title: `Quotation ${q.number} accepted`,
        documentKind: "quotation",
        documentId: id,
      });
    }
  }
  await db.update(quotations).set({ status }).where(eq(quotations.id, id));
  await logAudit({ documentKind: "quotation", documentId: id, action: "status_changed", detail: `→ ${status}` });
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
}

export async function deleteQuotation(id: number) {
  const [row] = await db
    .select({ number: quotations.number })
    .from(quotations)
    .where(eq(quotations.id, id))
    .limit(1);
  if (row) await logAudit({ documentKind: "quotation", documentId: id, documentNumber: row.number, action: "deleted" });
  await db.delete(quotations).where(eq(quotations.id, id));
  revalidatePath("/quotations");
  redirect(flashUrl(`/quotations` , "Quotation deleted"));
}

export async function convertToInvoice(id: number) {
  const quote = await db.query.quotations.findFirst({
    where: eq(quotations.id, id),
    with: { items: true },
  });
  if (!quote) throw new Error("Quotation not found");

  const number = await nextInvoiceNumber();
  const today = new Date();
  const due = new Date();
  due.setDate(due.getDate() + 14);

  const [inv] = await db
    .insert(invoices)
    .values({
      number,
      clientId: quote.clientId,
      issueDate: today.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      taxRate: quote.taxRate,
      discount: quote.discount,
      notes: quote.notes,
      paymentTerms: quote.paymentTerms,
      status: "draft",
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
    .set({ status: "accepted", convertedInvoiceId: inv.id })
    .where(eq(quotations.id, id));

  await logAudit({ documentKind: "quotation", documentId: id, action: "converted", detail: `invoice ${inv.id}` });

  revalidatePath("/quotations");
  revalidatePath("/invoices");
  redirect(flashUrl(`/invoices/${inv.id}` , "Converted to invoice"));
}
