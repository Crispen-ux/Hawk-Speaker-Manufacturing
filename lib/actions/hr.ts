"use server";

import { db } from "@/db";
import { contracts, leaveRequests, employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { notify } from "@/lib/actions/notifications";
import { flashUrl } from "@/lib/flash";

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

export async function createContract(formData: FormData) {
  const employeeId = Number(formData.get("employeeId"));
  const startDate = String(formData.get("startDate") ?? "");
  if (!employeeId) throw new Error("Employee is required");
  if (!startDate) throw new Error("Start date is required");

  await db.insert(contracts).values({
    employeeId,
    type: String(formData.get("type") ?? "permanent") as (typeof contracts.type.enumValues)[number],
    startDate,
    endDate: String(formData.get("endDate") ?? "") || null,
    hourlyRate: String(formData.get("hourlyRate") ?? "0"),
    notes: String(formData.get("notes") ?? "") || null,
  });

  revalidatePath("/hr");
  redirect(flashUrl(`/hr` , "Contract created"));
}

export async function deleteContract(id: number) {
  await db.delete(contracts).where(eq(contracts.id, id));
  revalidatePath("/hr");
  redirect(flashUrl(`/hr`, "Contract deleted"));
}

export async function createLeave(formData: FormData) {
  const employeeId = Number(formData.get("employeeId"));
  const fromDate = String(formData.get("fromDate") ?? "");
  const toDate = String(formData.get("toDate") ?? "");
  if (!employeeId) throw new Error("Employee is required");
  if (!fromDate || !toDate) throw new Error("Dates are required");

  await db.insert(leaveRequests).values({
    employeeId,
    type: String(formData.get("type") ?? "annual"),
    fromDate,
    toDate,
    days: daysBetween(fromDate, toDate),
    reason: String(formData.get("reason") ?? "") || null,
  });

  revalidatePath("/hr");
  redirect(flashUrl(`/hr` , "Leave request created"));
}

export async function setLeaveStatus(id: number, status: (typeof leaveRequests.status.enumValues)[number]) {
  await db.update(leaveRequests).set({ status }).where(eq(leaveRequests.id, id));

  const leave = await db.query.leaveRequests.findFirst({
    where: eq(leaveRequests.id, id),
    with: { employee: true },
  });
  if (leave) {
    void notify({
      title: `${leave.type} leave ${status === "approved" ? "approved" : status === "rejected" ? "rejected" : "updated"}`,
      message: `${leave.employee.firstName} ${leave.employee.lastName} · ${leave.fromDate} → ${leave.toDate} (${leave.days} days)`,
      documentKind: "employee",
      documentId: leave.employeeId,
      level: status === "approved" ? "success" : status === "rejected" ? "danger" : "info",
    });
  }

  revalidatePath("/hr");
}

export async function deleteLeave(id: number) {
  await db.delete(leaveRequests).where(eq(leaveRequests.id, id));
  revalidatePath("/hr");
  redirect(flashUrl(`/hr`, "Leave request deleted"));
}