"use server";

import { db } from "@/db";
import { payrollRuns, payrollEntries, employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";
import { toNumber } from "@/lib/money";
import { postPayrollPaid } from "@/lib/accounting/posting";

export async function createPayrollRun(formData: FormData) {
  const periodStart = String(formData.get("periodStart") ?? ""); const periodEnd = String(formData.get("periodEnd") ?? ""); const payDate = String(formData.get("payDate") ?? "");
  if (!periodStart || !periodEnd || !payDate) throw new Error("Period and pay date are required");
  const active = await db.select({ id: employees.id, salary: employees.salary }).from(employees).where(eq(employees.status, "active")); if (!active.length) throw new Error("No active employees to pay yet");
  const [run] = await db.insert(payrollRuns).values({ periodStart, periodEnd, payDate, notes: String(formData.get("notes") ?? "") || null }).returning({ id: payrollRuns.id });
  await db.insert(payrollEntries).values(active.map((e) => ({ runId: run.id, employeeId: e.id, salary: e.salary })));
  revalidatePath("/payroll"); redirect(flashUrl(`/payroll/${run.id}`, "Payroll run created"));
}

function moneyField(v: FormDataEntryValue | null, label: string): string { const s = String(v ?? "0").trim() || "0"; const n = Number(s); if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be zero or greater`); return s; }

export async function updatePayrollEntry(entryId: number, formData: FormData) {
  const [entry] = await db.query.payrollEntries.findMany({ where: eq(payrollEntries.id, entryId), with: { run: true } }); if (!entry) throw new Error("Payroll entry not found"); if (entry.run.status === "paid") throw new Error("Paid payroll is locked.");
  await db.update(payrollEntries).set({ salary: moneyField(formData.get("salary"), "Salary"), additions: moneyField(formData.get("additions"), "Additions"), tax: moneyField(formData.get("tax"), "PAYE"), uif: moneyField(formData.get("uif"), "UIF"), otherDeductions: moneyField(formData.get("other"), "Other deductions") }).where(eq(payrollEntries.id, entryId));
  revalidatePath("/payroll"); revalidatePath(`/payroll/${entry.runId}`);
}

export async function setPayrollStatus(id: number, status: (typeof payrollRuns.status.enumValues)[number]) {
  const [run] = await db.query.payrollRuns.findMany({ where: eq(payrollRuns.id, id), with: { entries: true } }); if (!run) throw new Error("Payroll run not found");
  if (run.status === "paid" && status !== "paid") throw new Error("Paid payroll runs cannot be rolled back.");
  if (status === "paid" && run.status !== "paid") {
    const totals = run.entries.reduce((sum, entry) => ({ gross: sum.gross + toNumber(entry.salary) + toNumber(entry.additions), tax: sum.tax + toNumber(entry.tax), uif: sum.uif + toNumber(entry.uif), other: sum.other + toNumber(entry.otherDeductions) }), { gross: 0, tax: 0, uif: 0, other: 0 });
    await postPayrollPaid({ runId: run.id, date: run.payDate, ...totals });
  }
  await db.update(payrollRuns).set({ status }).where(eq(payrollRuns.id, id)); revalidatePath("/payroll"); revalidatePath(`/payroll/${id}`); revalidatePath("/accounting/trial-balance"); revalidatePath("/accounting/balance-sheet");
}

export async function deletePayrollRun(id: number) {
  const [run] = await db.select({ status: payrollRuns.status }).from(payrollRuns).where(eq(payrollRuns.id, id)).limit(1); if (run?.status === "paid") throw new Error("Paid payroll cannot be deleted.");
  await db.delete(payrollRuns).where(eq(payrollRuns.id, id)); revalidatePath("/payroll"); redirect(flashUrl(`/payroll`, "Payroll run deleted"));
}
