"use server";

import { db } from "@/db";
import { supplierBills, supplierBillItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextSupplierBillNumber } from "@/lib/numbering";
import { flashUrl } from "@/lib/flash";
import { logAudit } from "@/lib/audit";
import { calcTotals, toNumber } from "@/lib/money";
import { postSupplierBillApproved, postSupplierPayment } from "@/lib/accounting/posting";

type VatTreatment = (typeof supplierBillItems.$inferInsert)["vatTreatment"] & string;
type ParsedItem = { bomItemId?: string; catalogItemId?: string; description?: string; quantity?: string; unitCost?: string; vatTreatment?: VatTreatment };
function toVat(value: string): (typeof supplierBillItems.$inferInsert)["vatTreatment"] { return value === "zero_rated" || value === "exempt" ? value : "standard"; }
function parseItems(formData: FormData): ParsedItem[] { try { return JSON.parse(String(formData.get("items") ?? "[]")); } catch { return []; } }
function totals(bill: { taxRate: string; discount: string; items: { quantity: string; unitCost: string }[] }) { return calcTotals(bill.items.map((it) => ({ quantity: it.quantity, unitPrice: it.unitCost })), bill.taxRate, bill.discount); }

export async function createSupplierBill(formData: FormData) {
  const supplierId = Number(formData.get("supplierId")); const description = String(formData.get("description") ?? "").trim(); const billDate = String(formData.get("billDate") ?? ""); const dueDate = String(formData.get("dueDate") ?? "") || null;
  const taxRate = String(formData.get("taxRate") ?? "0"); const discount = String(formData.get("discount") ?? "0"); const notes = String(formData.get("notes") ?? "") || null; const items = parseItems(formData).filter((it) => String(it.description ?? "").trim());
  if (!supplierId || !description || !billDate) throw new Error("Supplier, description and bill date are required");
  const number = await nextSupplierBillNumber(); const [row] = await db.insert(supplierBills).values({ number, supplierId, description, billDate, dueDate, taxRate, discount, notes, status: "submitted" }).returning({ id: supplierBills.id });
  if (items.length) await db.insert(supplierBillItems).values(items.map((it, i) => ({ supplierBillId: row.id, description: String(it.description ?? "").trim(), bomItemId: it.bomItemId ? Number(it.bomItemId) : null, catalogItemId: it.catalogItemId ? Number(it.catalogItemId) : null, quantity: String(it.quantity ?? "1"), unitCost: String(it.unitCost ?? "0"), vatTreatment: toVat(String(it.vatTreatment ?? "standard")), sortOrder: i })));
  await logAudit({ documentKind: "supplierBill", documentId: row.id, documentNumber: number, action: "created" }); revalidatePath("/supplier-bills"); redirect(flashUrl(`/supplier-bills/${row.id}`, "Supplier bill created"));
}

export async function updateSupplierBill(id: number, formData: FormData) {
  const [existing] = await db.select().from(supplierBills).where(eq(supplierBills.id, id)).limit(1); if (!existing) throw new Error("Supplier bill not found"); if (existing.status === "approved" || existing.paid) throw new Error("Approved or paid supplier bills are locked.");
  const supplierId = Number(formData.get("supplierId")); const description = String(formData.get("description") ?? "").trim(); const billDate = String(formData.get("billDate") ?? ""); const dueDate = String(formData.get("dueDate") ?? "") || null; const taxRate = String(formData.get("taxRate") ?? "0"); const discount = String(formData.get("discount") ?? "0"); const notes = String(formData.get("notes") ?? "") || null; const items = parseItems(formData).filter((it) => String(it.description ?? "").trim());
  if (!supplierId || !description || !billDate) throw new Error("Supplier, description and bill date are required");
  await db.update(supplierBills).set({ supplierId, description, billDate, dueDate, taxRate, discount, notes }).where(eq(supplierBills.id, id)); await db.delete(supplierBillItems).where(eq(supplierBillItems.supplierBillId, id));
  if (items.length) await db.insert(supplierBillItems).values(items.map((it, i) => ({ supplierBillId: id, description: String(it.description ?? "").trim(), bomItemId: it.bomItemId ? Number(it.bomItemId) : null, catalogItemId: it.catalogItemId ? Number(it.catalogItemId) : null, quantity: String(it.quantity ?? "1"), unitCost: String(it.unitCost ?? "0"), vatTreatment: toVat(String(it.vatTreatment ?? "standard")), sortOrder: i })));
  await logAudit({ documentKind: "supplierBill", documentId: id, action: "updated" }); revalidatePath("/supplier-bills"); revalidatePath(`/supplier-bills/${id}`); redirect(flashUrl(`/supplier-bills/${id}`, "Supplier bill updated"));
}

export async function setSupplierBillStatus(id: number, status: "submitted" | "approved" | "rejected") {
  const [bill] = await db.query.supplierBills.findMany({ where: eq(supplierBills.id, id), with: { items: true } }); if (!bill) throw new Error("Supplier bill not found");
  if (bill.status === "approved" && status !== "approved") throw new Error("Approved supplier bills cannot be rolled back.");
  if (status === "approved" && bill.status !== "approved") { const t = totals(bill); const inventoryAmount = bill.items.filter((item) => item.catalogItemId != null).reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitCost), 0); await postSupplierBillApproved({ supplierBillId: bill.id, number: bill.number, date: bill.billDate, subtotal: t.subtotal, tax: t.tax, inventoryAmount, expenseAmount: Math.max(t.subtotal - inventoryAmount, 0) }); }
  await db.update(supplierBills).set({ status, ...(status === "approved" ? { approvedAt: new Date() } : {}) }).where(eq(supplierBills.id, id)); await logAudit({ documentKind: "supplierBill", documentId: id, action: "status_changed", detail: `→ ${status}` });
  revalidatePath("/supplier-bills"); revalidatePath(`/supplier-bills/${id}`); revalidatePath("/accounting/trial-balance"); revalidatePath("/accounting/balance-sheet");
}

export async function markSupplierBillPaid(id: number, paid: boolean) {
  const [bill] = await db.query.supplierBills.findMany({ where: eq(supplierBills.id, id), with: { items: true } }); if (!bill) throw new Error("Supplier bill not found"); if (bill.status !== "approved") throw new Error("Supplier bill must be approved before payment."); if (!paid) throw new Error("Supplier payments are immutable; use a correcting transaction."); if (bill.paid) return;
  const t = totals(bill); const paidDate = new Date().toISOString().slice(0, 10); await postSupplierPayment({ supplierBillId: bill.id, number: bill.number, date: paidDate, amount: t.total });
  await db.update(supplierBills).set({ paid: true, paidDate }).where(eq(supplierBills.id, id)); await logAudit({ documentKind: "supplierBill", documentId: id, action: "marked_paid" }); revalidatePath("/supplier-bills"); revalidatePath(`/supplier-bills/${id}`); revalidatePath("/accounting/trial-balance");
}

export async function deleteSupplierBill(id: number) {
  const [row] = await db.select().from(supplierBills).where(eq(supplierBills.id, id)); if (!row) return; if (row.status === "approved" || row.paid) throw new Error("Approved or paid supplier bills cannot be deleted.");
  await logAudit({ documentKind: "supplierBill", documentId: id, documentNumber: row.number, action: "deleted" }); await db.delete(supplierBills).where(eq(supplierBills.id, id)); revalidatePath("/supplier-bills"); redirect(flashUrl("/supplier-bills", "Supplier bill deleted"));
}
