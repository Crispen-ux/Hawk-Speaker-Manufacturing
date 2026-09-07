"use server";

import { db } from "@/db";
import { creditNotes, creditNoteItems, invoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextCreditNoteNumber } from "@/lib/numbering";
import { logAudit } from "@/lib/audit";
import { flashUrl } from "@/lib/flash";
import { calcTotals } from "@/lib/money";
import { postCreditNoteIssued } from "@/lib/accounting/posting";

type ItemInput = { description: string; quantity: string; unitPrice: string };
function parseItems(raw: string): ItemInput[] {
  try { const arr = JSON.parse(raw); if (!Array.isArray(arr)) return []; return arr.filter((it) => it && String(it.description ?? "").trim()).map((it) => ({ description: String(it.description), quantity: String(it.quantity ?? "1"), unitPrice: String(it.unitPrice ?? "0") })); } catch { return []; }
}

export async function createCreditNote(formData: FormData) {
  const clientId = Number(formData.get("clientId")); const invoiceIdRaw = formData.get("invoiceId"); const invoiceId = invoiceIdRaw ? Number(invoiceIdRaw) : null;
  const issueDate = String(formData.get("issueDate")); const taxRate = String(formData.get("taxRate") ?? "0"); const discount = String(formData.get("discount") ?? "0");
  const notes = String(formData.get("notes") ?? "") || null; const paymentTerms = String(formData.get("paymentTerms") ?? "") || null; const items = parseItems(String(formData.get("items") ?? "[]"));
  if (!clientId) throw new Error("Client is required"); if (!items.length) throw new Error("Add at least one line item"); if (invoiceId && !Number.isFinite(invoiceId)) throw new Error("Invalid invoice");
  const number = await nextCreditNoteNumber();
  const [row] = await db.insert(creditNotes).values({ number, clientId, invoiceId, issueDate, taxRate, discount, notes, paymentTerms, status: "draft" }).returning({ id: creditNotes.id });
  await db.insert(creditNoteItems).values(items.map((it, i) => ({ creditNoteId: row.id, description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, sortOrder: i })));
  await logAudit({ documentKind: "creditNote", documentId: row.id, documentNumber: number, action: "created" });
  revalidatePath("/credit-notes"); revalidatePath("/invoices"); redirect(flashUrl(`/credit-notes/${row.id}`, "Credit note created"));
}

export async function updateCreditNote(id: number, formData: FormData) {
  const [existing] = await db.select({ status: creditNotes.status }).from(creditNotes).where(eq(creditNotes.id, id)).limit(1);
  if (!existing) throw new Error("Credit note not found"); if (existing.status !== "draft") throw new Error("Issued credit notes are locked.");
  const clientId = Number(formData.get("clientId")); const invoiceIdRaw = formData.get("invoiceId"); const invoiceId = invoiceIdRaw ? Number(invoiceIdRaw) : null;
  const issueDate = String(formData.get("issueDate")); const taxRate = String(formData.get("taxRate") ?? "0"); const discount = String(formData.get("discount") ?? "0");
  const notes = String(formData.get("notes") ?? "") || null; const paymentTerms = String(formData.get("paymentTerms") ?? "") || null; const items = parseItems(String(formData.get("items") ?? "[]"));
  if (!clientId || !issueDate || !items.length) throw new Error("Client, date and at least one line item are required");
  await db.update(creditNotes).set({ clientId, invoiceId, issueDate, taxRate, discount, notes, paymentTerms }).where(eq(creditNotes.id, id));
  await db.delete(creditNoteItems).where(eq(creditNoteItems.creditNoteId, id));
  await db.insert(creditNoteItems).values(items.map((it, i) => ({ creditNoteId: id, description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, sortOrder: i })));
  await logAudit({ documentKind: "creditNote", documentId: id, action: "updated" });
  revalidatePath("/credit-notes"); revalidatePath(`/credit-notes/${id}`); redirect(flashUrl(`/credit-notes/${id}`, "Credit note updated"));
}

export async function setCreditNoteStatus(id: number, status: (typeof creditNotes.status.enumValues)[number]) {
  const [note] = await db.query.creditNotes.findMany({ where: eq(creditNotes.id, id), with: { items: true } });
  if (!note) throw new Error("Credit note not found");
  if (note.status !== "draft" && status === "draft") throw new Error("Issued credit notes cannot return to draft");
  if (note.status === "draft" && (status === "issued" || status === "applied")) {
    const t = calcTotals(note.items, note.taxRate, note.discount);
    await postCreditNoteIssued({ creditNoteId: note.id, number: note.number, date: note.issueDate, subtotal: t.subtotal - t.discount, tax: t.tax });
  }
  await db.update(creditNotes).set({ status }).where(eq(creditNotes.id, id));
  await logAudit({ documentKind: "creditNote", documentId: id, action: "status_changed", detail: `→ ${status}` });
  if (note.invoiceId) {
    const [inv] = await db.select({ number: invoices.number }).from(invoices).where(eq(invoices.id, note.invoiceId)).limit(1);
    if (inv) await logAudit({ documentKind: "invoice", documentId: note.invoiceId, documentNumber: inv.number, action: "credit_note_issued", detail: note.number });
    revalidatePath(`/invoices/${note.invoiceId}`);
  }
  revalidatePath("/credit-notes"); revalidatePath(`/credit-notes/${id}`); revalidatePath("/accounting/control"); revalidatePath("/accounting/trial-balance"); revalidatePath("/accounting/income-statement"); revalidatePath("/accounting/balance-sheet");
}

export async function deleteCreditNote(id: number) {
  const [row] = await db.select({ number: creditNotes.number, status: creditNotes.status }).from(creditNotes).where(eq(creditNotes.id, id)).limit(1);
  if (!row) return; if (row.status !== "draft") throw new Error("Issued credit notes cannot be deleted.");
  await logAudit({ documentKind: "creditNote", documentId: id, documentNumber: row.number, action: "deleted" });
  await db.delete(creditNotes).where(eq(creditNotes.id, id));
  revalidatePath("/credit-notes"); revalidatePath("/invoices"); redirect(flashUrl(`/credit-notes`, "Credit note deleted"));
}
