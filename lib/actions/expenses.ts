"use server";

import { db } from "@/db";
import { expenses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";

export async function createExpense(formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  if (!description) throw new Error("Description is required");

  const [row] = await db
    .insert(expenses)
    .values({
      description,
      amount: String(formData.get("amount") ?? "0"),
      date: String(formData.get("date") ?? ""),
      category: String(formData.get("category") ?? "") || null,
      paymentMethod: String(formData.get("paymentMethod") ?? "") || null,
      supplierId: Number(formData.get("supplierId")) || null,
      reference: String(formData.get("reference") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    })
    .returning({ id: expenses.id });

  void logAudit({
    documentKind: "expense",
    documentId: row.id,
    documentNumber: undefined,
    action: "created",
    detail: description,
  });

  revalidatePath("/expenses");
  redirect(`/expenses/${row.id}`);
}

export async function updateExpense(id: number, formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  await db
    .update(expenses)
    .set({
      description,
      amount: String(formData.get("amount") ?? "0"),
      date: String(formData.get("date") ?? ""),
      category: String(formData.get("category") ?? "") || null,
      paymentMethod: String(formData.get("paymentMethod") ?? "") || null,
      supplierId: Number(formData.get("supplierId")) || null,
      reference: String(formData.get("reference") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    })
    .where(eq(expenses.id, id));

  void logAudit({ documentKind: "expense", documentId: id, action: "updated", detail: description });

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  redirect(`/expenses/${id}`);
}

export async function deleteExpense(id: number) {
  const [exp] = await db.select().from(expenses).where(eq(expenses.id, id));
  await db.delete(expenses).where(eq(expenses.id, id));
  if (exp) void logAudit({ documentKind: "expense", documentId: id, action: "deleted", detail: exp.description });
  revalidatePath("/expenses");
  redirect("/expenses");
}