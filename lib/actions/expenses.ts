"use server";

import { db } from "@/db";
import { expenses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { flashUrl } from "@/lib/flash";

export async function createExpense(formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  if (!description) throw new Error("Description is required");

  const jobCardId = (() => {
    const v = formData.get("jobCardId");
    return v ? Number(v) : null;
  })();

  const [row] = await db
    .insert(expenses)
    .values({
      description,
      amount: String(formData.get("amount") ?? "0"),
      date: String(formData.get("date") ?? ""),
      category: String(formData.get("category") ?? "") || null,
      paymentMethod: String(formData.get("paymentMethod") ?? "") || null,
      supplierId: Number(formData.get("supplierId")) || null,
      accountId: Number(formData.get("accountId")) || null,
      reference: String(formData.get("reference") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
      jobCardId,
      vatTreatment: String(formData.get("vatTreatment") ?? "standard") as "standard" | "zero_rated" | "exempt",
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
  if (jobCardId) revalidatePath(`/job-cards/${jobCardId}`);
  redirect(flashUrl(`/expenses/${row.id}`, "Expense created"));
}

export async function updateExpense(id: number, formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  const jobCardId = (() => {
    const v = formData.get("jobCardId");
    return v ? Number(v) : null;
  })();

  const [existing] = await db.select({ jobCardId: expenses.jobCardId }).from(expenses).where(eq(expenses.id, id));

  await db
    .update(expenses)
    .set({
      description,
      amount: String(formData.get("amount") ?? "0"),
      date: String(formData.get("date") ?? ""),
      category: String(formData.get("category") ?? "") || null,
      paymentMethod: String(formData.get("paymentMethod") ?? "") || null,
      supplierId: Number(formData.get("supplierId")) || null,
      accountId: Number(formData.get("accountId")) || null,
      reference: String(formData.get("reference") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
      jobCardId,
      vatTreatment: String(formData.get("vatTreatment") ?? "standard") as "standard" | "zero_rated" | "exempt",
    })
    .where(eq(expenses.id, id));

  void logAudit({ documentKind: "expense", documentId: id, action: "updated", detail: description });

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  if (existing?.jobCardId) revalidatePath(`/job-cards/${existing.jobCardId}`);
  if (jobCardId && jobCardId !== existing?.jobCardId) revalidatePath(`/job-cards/${jobCardId}`);
  redirect(flashUrl(`/expenses/${id}`, "Expense updated"));
}

export async function setExpenseStatus(id: number, status: "submitted" | "approved" | "rejected") {
  const patch: { status: typeof status; approvedById?: number | null; approvedAt?: Date } = { status };
  if (status === "approved") {
    patch.approvedAt = new Date();
  }
  await db.update(expenses).set(patch).where(eq(expenses.id, id));
  await logAudit({ documentKind: "expense", documentId: id, action: "status_changed", detail: `-> ${status}` });
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
}

export async function deleteExpense(id: number) {
  const [exp] = await db.select().from(expenses).where(eq(expenses.id, id));
  await db.delete(expenses).where(eq(expenses.id, id));
  if (exp) void logAudit({ documentKind: "expense", documentId: id, action: "deleted", detail: exp.description });
  revalidatePath("/expenses");
  if (exp?.jobCardId) revalidatePath(`/job-cards/${exp.jobCardId}`);
  redirect(flashUrl("/expenses", "Expense deleted"));
}
