"use server";

import { db } from "@/db";
import { employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";

export async function createEmployee(formData: FormData) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!firstName) throw new Error("First name is required");
  if (!lastName) throw new Error("Last name is required");
  if (!email) throw new Error("Email is required");

  const [row] = await db
    .insert(employees)
    .values({
      firstName,
      lastName,
      email,
      phone: String(formData.get("phone") ?? "") || null,
      position: String(formData.get("position") ?? "") || null,
      department: String(formData.get("department") ?? "") || null,
      idNumber: String(formData.get("idNumber") ?? "") || null,
      startDate: String(formData.get("startDate") ?? "") || null,
      salary: String(formData.get("salary") ?? "0"),
      notes: String(formData.get("notes") ?? "") || null,
    })
    .returning({ id: employees.id });

  revalidatePath("/employees");
  redirect(flashUrl(`/employees/${row.id}` , "Employee created"));
}

export async function updateEmployee(id: number, formData: FormData) {
  await db
    .update(employees)
    .set({
      firstName: String(formData.get("firstName") ?? "").trim(),
      lastName: String(formData.get("lastName") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "") || null,
      position: String(formData.get("position") ?? "") || null,
      department: String(formData.get("department") ?? "") || null,
      idNumber: String(formData.get("idNumber") ?? "") || null,
      startDate: String(formData.get("startDate") ?? "") || null,
      salary: String(formData.get("salary") ?? "0"),
      notes: String(formData.get("notes") ?? "") || null,
    })
    .where(eq(employees.id, id));

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  redirect(flashUrl(`/employees/${id}` , "Employee updated"));
}

export async function setEmployeeStatus(id: number, status: (typeof employees.status.enumValues)[number]) {
  await db.update(employees).set({ status }).where(eq(employees.id, id));
  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
}

export async function deleteEmployee(id: number) {
  await db.delete(employees).where(eq(employees.id, id));
  revalidatePath("/employees");
  redirect(flashUrl(`/employees` , "Employee deleted"));
}