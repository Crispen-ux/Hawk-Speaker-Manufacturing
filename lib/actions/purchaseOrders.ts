"use server";

import { db } from "@/db";
import { purchaseOrders, purchaseOrderItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextPurchaseOrderNumber } from "@/lib/numbering";
import { logAudit } from "@/lib/audit";
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

export async function createPurchaseOrder(formData: FormData) {
  const supplierId = Number(formData.get("supplierId"));
  const issueDate = String(formData.get("issueDate"));
  const expectedDate = String(formData.get("expectedDate") ?? "") || null;
  const taxRate = String(formData.get("taxRate") ?? "0");
  const discount = String(formData.get("discount") ?? "0");
  const notes = String(formData.get("notes") ?? "") || null;
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (!supplierId) throw new Error("Supplier is required");
  if (items.length === 0) throw new Error("Add at least one line item");

  const number = await nextPurchaseOrderNumber();

  const [row] = await db
    .insert(purchaseOrders)
    .values({ number, supplierId, issueDate, expectedDate, taxRate, discount, notes, status: "draft" })
    .returning({ id: purchaseOrders.id });

  await db.insert(purchaseOrderItems).values(
    items.map((it, i) => ({
      purchaseOrderId: row.id,
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      sortOrder: i,
    }))
  );

  await logAudit({ documentKind: "purchaseOrder", documentId: row.id, documentNumber: number, action: "created" });

  revalidatePath("/purchase-orders");
  redirect(flashUrl(`/purchase-orders/${row.id}` , "Purchase order created"));
}

export async function updatePurchaseOrder(id: number, formData: FormData) {
  const supplierId = Number(formData.get("supplierId"));
  const issueDate = String(formData.get("issueDate"));
  const expectedDate = String(formData.get("expectedDate") ?? "") || null;
  const taxRate = String(formData.get("taxRate") ?? "0");
  const discount = String(formData.get("discount") ?? "0");
  const notes = String(formData.get("notes") ?? "") || null;
  const items = parseItems(String(formData.get("items") ?? "[]"));

  await db
    .update(purchaseOrders)
    .set({ supplierId, issueDate, expectedDate, taxRate, discount, notes })
    .where(eq(purchaseOrders.id, id));

  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
  if (items.length > 0) {
    await db.insert(purchaseOrderItems).values(
      items.map((it, i) => ({
        purchaseOrderId: id,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        sortOrder: i,
      }))
    );
  }

  await logAudit({ documentKind: "purchaseOrder", documentId: id, action: "updated" });

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
  redirect(flashUrl(`/purchase-orders/${id}` , "Purchase order updated"));
}

export async function setPurchaseOrderStatus(
  id: number,
  status: (typeof purchaseOrders.status.enumValues)[number]
) {
  await db.update(purchaseOrders).set({ status }).where(eq(purchaseOrders.id, id));
  await logAudit({ documentKind: "purchaseOrder", documentId: id, action: "status_changed", detail: `→ ${status}` });
  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
}

export async function deletePurchaseOrder(id: number) {
  const [row] = await db
    .select({ number: purchaseOrders.number })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, id))
    .limit(1);
  if (row) await logAudit({ documentKind: "purchaseOrder", documentId: id, documentNumber: row.number, action: "deleted" });
  await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
  revalidatePath("/purchase-orders");
  redirect(flashUrl(`/purchase-orders` , "Purchase order deleted"));
}
