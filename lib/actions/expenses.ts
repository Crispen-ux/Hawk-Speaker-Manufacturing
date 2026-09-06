"use server";

import { db } from "@/db";
import { expenses, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { flashUrl } from "@/lib/flash";
import { toNumber } from "@/lib/money";
import { postExpenseApproved } from "@/lib/accounting/posting";

const categoryCode = (category: string | null) => {
  if (/fuel|diesel|petrol|transport|travel|bakkie|vehicle/i.test(category ?? "")) return "5400";
  if (/rent|utilities|light|water|electr/i.test(category ?? "")) return "5300";
  if (/material|suppl|tools|stock|parts/i.test(category ?? "")) return "5500";
  if (/market|advert|promo|social/i.test(category ?? "")) return "5600";
  if (/insurance/i.test(category ?? "")) return "5700";
  if (/wage|salary|labour|labor|payroll/i.test(category ?? "")) return "5000";
  if (/admin|office|stationery|software|bank?charges/i.test(category ?? "")) return "5200";
  return "5100";
};

async function resolveAccountCode(accountId: number | null, category: string | null) {
  if (accountId) {
    const [account] = await db.select({ code: accounts.code }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
    if (account?.code) return account.code;
  }
  return categoryCode(category);
}

export async function createExpense(formData: FormData) {
  const description = String(formData.get("description") ?? "").trim(); if (!description) throw new Error("Description is required");
  const jobCardId = (() => { const v = formData.get("jobCardId"); return v ? Number(v) : null; })();
  const [row] = await db.insert(expenses).values({ description, amount: String(formData.get("amount") ?? "0"), date: String(formData.get("date") ?? ""), category: String(formData.get("category") ?? "") || null, paymentMethod: String(formData.get("paymentMethod") ?? "") || null, supplierId: Number(formData.get("supplierId")) || null, accountId: Number(formData.get("accountId")) || null, reference: String(formData.get("reference") ?? "") || null, notes: String(formData.get("notes") ?? "") || null, jobCardId, vatTreatment: String(formData.get("vatTreatment") ?? "standard") as "standard" | "zero_rated" | "exempt" }).returning({ id: expenses.id });
  await logAudit({ documentKind: "expense", documentId: row.id, action: "created", detail: description });
  revalidatePath("/expenses"); if (jobCardId) revalidatePath(`/job-cards/${jobCardId}`); redirect(flashUrl(`/expenses/${row.id}`, "Expense created"));
}

export async function updateExpense(id: number, formData: FormData) {
  const [existing] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1); if (!existing) throw new Error("Expense not found");
  if (existing.status === "approved") throw new Error("Approved expenses are locked and cannot be edited.");
  const description = String(formData.get("description") ?? "").trim(); const jobCardId = (() => { const v = formData.get("jobCardId"); return v ? Number(v) : null; })();
  await db.update(expenses).set({ description, amount: String(formData.get("amount") ?? "0"), date: String(formData.get("date") ?? ""), category: String(formData.get("category") ?? "") || null, paymentMethod: String(formData.get("paymentMethod") ?? "") || null, supplierId: Number(formData.get("supplierId")) || null, accountId: Number(formData.get("accountId")) || null, reference: String(formData.get("reference") ?? "") || null, notes: String(formData.get("notes") ?? "") || null, jobCardId, vatTreatment: String(formData.get("vatTreatment") ?? "standard") as "standard" | "zero_rated" | "exempt" }).where(eq(expenses.id, id));
  await logAudit({ documentKind: "expense", documentId: id, action: "updated", detail: description });
  revalidatePath("/expenses"); revalidatePath(`/expenses/${id}`); redirect(flashUrl(`/expenses/${id}`, "Expense updated"));
}

export async function setExpenseStatus(id: number, status: "submitted" | "approved" | "rejected") {
  const [existing] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1); if (!existing) throw new Error("Expense not found");
  if (existing.status === "approved" && status !== "approved") throw new Error("Approved expenses cannot be reversed by editing status. Use a correcting journal/refund.");
  if (status === "approved" && existing.status !== "approved") await postExpenseApproved({ expenseId: id, date: existing.date, amount: toNumber(existing.amount), accountCode: await resolveAccountCode(existing.accountId, existing.category) });
  await db.update(expenses).set({ status, ...(status === "approved" ? { approvedAt: new Date() } : {}) }).where(eq(expenses.id, id));
  await logAudit({ documentKind: "expense", documentId: id, action: "status_changed", detail: `→ ${status}` });
  revalidatePath("/expenses"); revalidatePath(`/expenses/${id}`); revalidatePath("/accounting/trial-balance"); revalidatePath("/accounting/income-statement"); revalidatePath("/accounting/balance-sheet");
}

export async function deleteExpense(id: number) {
  const [exp] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1); if (!exp) return;
  if (exp.status === "approved") throw new Error("Approved expenses cannot be deleted. Record a correcting transaction instead.");
  await db.delete(expenses).where(eq(expenses.id, id)); await logAudit({ documentKind: "expense", documentId: id, action: "deleted", detail: exp.description });
  revalidatePath("/expenses"); if (exp.jobCardId) revalidatePath(`/job-cards/${exp.jobCardId}`); redirect(flashUrl("/expenses", "Expense deleted"));
}
