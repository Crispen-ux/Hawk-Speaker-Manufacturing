"use server";

import { db } from "@/db";
import { payrollRuns, payrollEntries, employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";

export async function createPayrollRun(formData: FormData) {
  const periodStart = String(formData.get("periodStart") ?? "");
  const periodEnd = String(formData.get("periodEnd") ?? "");
  const payDate = String(formData.get("payDate") ?? "");
  if (!periodStart || !periodEnd || !payDate) throw new Error("Period and pay date are required");

  const active = await db
    .select({ id: employees.id, salary: employees.salary })
    .from(employees)
    .where(eq(employees.status, "active"));

  if (active.length === 0) throw new Error("No active employees to pay yet");

  const [run] = await db
    .insert(payrollRuns)
    .values({
      periodStart,
      periodEnd,
      payDate,
      notes: String(formData.get("notes") ?? "") || null,
    })
    .returning({ id: payrollRuns.id });

  await db.insert(payrollEntries).values(
    active.map((e) => ({ runId: run.id, employeeId: e.id, salary: e.salary }))
  );

  revalidatePath("/payroll");
  redirect(flashUrl(`/payroll/${run.id}` , "Payroll run created"));
}

function moneyField(v: FormDataEntryValue | null, label: string): string {
  const s = String(v ?? "0").trim() || "0";
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a positive number`);
  return s;
}

export async function updatePayrollEntry(entryId: number, formData: FormData) {
  const salary = moneyField(formData.get("salary"), "Salary");
  const additions = moneyField(formData.get("additions"), "Additions");
  const tax = moneyField(formData.get("tax"), "PAYE");
  const uif = moneyField(formData.get("uif"), "UIF");
  const otherDeductions = moneyField(formData.get("other"), "Other deductions");
  const [entry] = await db
    .select({ runId: payrollEntries.runId })
    .from(payrollEntries)
    .where(eq(payrollEntries.id, entryId));
  await db
    .update(payrollEntries)
    .set({ salary, additions, tax, uif, otherDeductions })
    .where(eq(payrollEntries.id, entryId));
  revalidatePath("/payroll");
  if (entry) revalidatePath(`/payroll/${entry.runId}`);
}

export async function setPayrollStatus(id: number, status: (typeof payrollRuns.status.enumValues)[number]) {
  await db.update(payrollRuns).set({ status }).where(eq(payrollRuns.id, id));
  revalidatePath("/payroll");
  revalidatePath(`/payroll/${id}`);
}

export async function deletePayrollRun(id: number) {
  await db.delete(payrollRuns).where(eq(payrollRuns.id, id));
  revalidatePath("/payroll");
  redirect(flashUrl(`/payroll` , "Payroll run deleted"));
}