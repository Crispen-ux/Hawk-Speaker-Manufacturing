"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hashPassword, requireAdmin } from "@/lib/auth";

function roleFromForm(v: FormDataEntryValue | null): "admin" | "staff" {
  return v === "admin" ? "admin" : "staff";
}

export async function createUser(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const name = String(formData.get("name") ?? "").trim() || null;
  const password = String(formData.get("password") ?? "");
  const role = roleFromForm(formData.get("role"));

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) throw new Error("A user with that email already exists.");

  await db.insert(users).values({
    email,
    name,
    passwordHash: hashPassword(password),
    role,
    active: true,
  });

  revalidatePath("/users");
}

export async function setUserActive(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "1";
  if (!Number.isFinite(id)) throw new Error("Invalid user.");

  await db
    .update(users)
    .set({ active, updatedAt: new Date() })
    .where(eq(users.id, id));

  revalidatePath("/users");
}

export async function setUserRole(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const role = roleFromForm(formData.get("role"));
  if (!Number.isFinite(id)) throw new Error("Invalid user.");

  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id));

  revalidatePath("/users");
}

export async function resetUserPassword(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  if (!Number.isFinite(id)) throw new Error("Invalid user.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  await db
    .update(users)
    .set({ passwordHash: hashPassword(password), updatedAt: new Date() })
    .where(eq(users.id, id));
  revalidatePath("/users");
}
