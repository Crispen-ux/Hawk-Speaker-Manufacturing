"use server";

import { db } from "@/db";
import { supplierBills, supplierBillItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextSupplierBillNumber } from "@/lib/numbering";
import { flashUrl } from "@/lib/flash";
import { logAudit } from "@/lib/audit";

type VatTreatment = (typeof supplierBillItems.$inferInsert)["vatTreatment"] & string;
type ParsedItem = {
  bomItemId?: string;
  catalogItemId?: string;
  description?: string;
  quantity?: string;
  unitCost?: string;
  vatTreatment?: VatTreatment;
};

function toVat(value: string): (typeof supplierBillItems.$inferInsert)["vatTreatment"] {
  if (value === "zero_rated" || value === "exempt") return value;
  return "standard";
}

function parseItems(formData: FormData): ParsedItem[] {
  try {
    return JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return [];
  }
}

export async function createSupplierBill(formData: FormData) {
  const supplierId = Number(formData.get("supplierId"));
  const description = String(formData.get("description") ?? "").trim();
  const billDate = String(formData.get("billDate") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "") || null;
  const taxRate = String(formData.get("taxRate") ?? "0");
  const discount = String(formData.get("discount") ?? "0");
  const notes = String(formData.get("notes") ?? "") || null;
  const items = parseItems(formData).filter((it) => String(it.description ?? "").trim() !== "");

  if (!supplierId) throw new Error("Supplier is required");
  if (!description) throw new Error("Description is required");
  if (!billDate) throw new Error("Bill date is required");

  const number = await nextSupplierBillNumber();

  const [row] = await db
    .insert(supplierBills)
    .values({
      number,
      supplierId,
      description,
      billDate,
      dueDate,
      taxRate,
      discount,
      notes,
      status: "submitted",
    })
    .returning({ id: supplierBills.id });

  if (items.length > 0) {
    await db.insert(supplierBillItems).values(
      items.map((it, i) => ({
        supplierBillId: row.id,
        description: String(it.description ?? "").trim(),
        bomItemId: it.bomItemId ? Number(it.bomItemId) : null,
        catalogItemId: it.catalogItemId ? Number(it.catalogItemId) : null,
        quantity: String(it.quantity ?? "1"),
        unitCost: String(it.unitCost ?? "0"),
        vatTreatment: toVat(String(it.vatTreatment ?? "standard")),
        sortOrder: i,
      }))
    );
  }

  await logAudit({ documentKind: "supplierBill", documentId: row.id, documentNumber: number, action: "created" });

  revalidatePath("/supplier-bills");
  redirect(flashUrl(`/supplier-bills/${row.id}`, "Supplier bill created"));
}

export async function updateSupplierBill(id: number, formData: FormData) {
  const supplierId = Number(formData.get("supplierId"));
  const description = String(formData.get("description") ?? "").trim();
  const billDate = String(formData.get("billDate") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "") || null;
  const taxRate = String(formData.get("taxRate") ?? "0");
  const discount = String(formData.get("discount") ?? "0");
  const notes = String(formData.get("notes") ?? "") || null;
  const items = parseItems(formData).filter((it) => String(it.description ?? "").trim() !== "");

  if (!supplierId) throw new Error("Supplier is required");
  if (!description) throw new Error("Description is required");
  if (!billDate) throw new Error("Bill date is required");

  await db
    .update(supplierBills)
    .set({ supplierId, description, billDate, dueDate, taxRate, discount, notes })
    .where(eq(supplierBills.id, id));

  await db.delete(supplierBillItems).where(eq(supplierBillItems.supplierBillId, id));
  if (items.length > 0) {
    await db.insert(supplierBillItems).values(
      items.map((it, i) => ({
        supplierBillId: id,
        description: String(it.description ?? "").trim(),
        bomItemId: it.bomItemId ? Number(it.bomItemId) : null,
        catalogItemId: it.catalogItemId ? Number(it.catalogItemId) : null,
        quantity: String(it.quantity ?? "1"),
        unitCost: String(it.unitCost ?? "0"),
        vatTreatment: toVat(String(it.vatTreatment ?? "standard")),
        sortOrder: i,
      }))
    );
  }

  await logAudit({ documentKind: "supplierBill", documentId: id, action: "updated" });

  revalidatePath("/supplier-bills");
  revalidatePath(`/supplier-bills/${id}`);
  redirect(flashUrl(`/supplier-bills/${id}`, "Supplier bill updated"));
}

export async function setSupplierBillStatus(id: number, status: "submitted" | "approved" | "rejected") {
  const patch: { status: typeof status; approvedById?: number | null; approvedAt?: Date } = { status };
  if (status === "approved") {
    patch.approvedAt = new Date();
  }
  await db.update(supplierBills).set(patch).where(eq(supplierBills.id, id));
  await logAudit({ documentKind: "supplierBill", documentId: id, action: "status_changed", detail: `-> ${status}` });
  revalidatePath("/supplier-bills");
  revalidatePath(`/supplier-bills/${id}`);
}

export async function markSupplierBillPaid(id: number, paid: boolean) {
  const patch: { paid: boolean; paidDate?: string | null } = { paid };
  patch.paidDate = paid ? new Date().toISOString().slice(0, 10) : null;
  await db.update(supplierBills).set(patch).where(eq(supplierBills.id, id));
  await logAudit({ documentKind: "supplierBill", documentId: id, action: paid ? "marked_paid" : "marked_unpaid" });
  revalidatePath("/supplier-bills");
  revalidatePath(`/supplier-bills/${id}`);
}

export async function deleteSupplierBill(id: number) {
  const [row] = await db.select().from(supplierBills).where(eq(supplierBills.id, id));
  if (row) await logAudit({ documentKind: "supplierBill", documentId: id, documentNumber: row.number, action: "deleted" });
  await db.delete(supplierBills).where(eq(supplierBills.id, id));
  revalidatePath("/supplier-bills");
  redirect(flashUrl("/supplier-bills", "Supplier bill deleted"));
}
