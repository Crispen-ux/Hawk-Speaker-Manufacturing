"use server";

import { db } from "@/db";
import { clients, portalUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";
import { hashPortalPassword } from "@/lib/auth-portal";
import { notify } from "@/lib/actions/notifications";
import { logAudit } from "@/lib/audit";

export async function createClient(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  const [row] = await db
    .insert(clients)
    .values({
      name,
      email: String(formData.get("email") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      registrationNumber: String(formData.get("registrationNumber") ?? "") || null,
      vatNumber: String(formData.get("vatNumber") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    })
    .returning({ id: clients.id });

  revalidatePath("/clients");
  redirect(flashUrl(`/clients/${row.id}` , "Client created"));
}

export async function updateClient(id: number, formData: FormData) {
  await db
    .update(clients)
    .set({
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      registrationNumber: String(formData.get("registrationNumber") ?? "") || null,
      vatNumber: String(formData.get("vatNumber") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    })
    .where(eq(clients.id, id));

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}

export async function deleteClient(id: number) {
  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath("/clients");
  redirect(flashUrl(`/clients` , "Client deleted"));
}

// ---------- Client portal access ----------

/** Creates (or reactivates) a portal login for a client. */
export async function createPortalAccess(clientId: number, formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email) redirect(flashUrl(`/clients/${clientId}`, "An email address is required", "error"));
  if (password.length < 8) redirect(flashUrl(`/clients/${clientId}`, "Password must be at least 8 characters", "error"));

  const existing = await db.select().from(portalUsers).where(eq(portalUsers.email, email)).limit(1);
  if (existing[0]) redirect(flashUrl(`/clients/${clientId}`, "A portal user with that email already exists", "error"));

  await db
    .insert(portalUsers)
    .values({ clientId, email, name: name || null, passwordHash: hashPortalPassword(password), active: true });

  await logAudit({
    documentKind: "client",
    documentId: clientId,
    action: "portal_granted",
    detail: `Portal access for ${email}`,
  });
  await notify({
    title: "Client portal access granted",
    message: `${name || email} can now sign in to the client portal.`,
    documentKind: "client",
    documentId: clientId,
    level: "success",
  });

  revalidatePath(`/clients/${clientId}`);
  redirect(flashUrl(`/clients/${clientId}`, "Portal access created", "success"));
}

/** Toggles whether a client's portal login is active. */
export async function togglePortalAccess(clientId: number, userId: number, formData: FormData) {
  const active = formData.get("active") === "on";
  await db.update(portalUsers).set({ active }).where(eq(portalUsers.id, userId));
  await logAudit({
    documentKind: "client",
    documentId: clientId,
    action: active ? "portal_enabled" : "portal_disabled",
    detail: `Portal user ${userId}`,
  });
  revalidatePath(`/clients/${clientId}`);
  redirect(flashUrl(`/clients/${clientId}`, `Portal access ${active ? "enabled" : "disabled"}`, "success"));
}

/** Resets a client portal user's password. */
export async function resetPortalPassword(clientId: number, userId: number, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect(flashUrl(`/clients/${clientId}`, "Password must be at least 8 characters", "error"));
  await db.update(portalUsers).set({ passwordHash: hashPortalPassword(password) }).where(eq(portalUsers.id, userId));
  revalidatePath(`/clients/${clientId}`);
  redirect(flashUrl(`/clients/${clientId}`, "Password reset", "success"));
}

/** Removes a client's portal login entirely. */
export async function deletePortalAccess(clientId: number, userId: number) {
  await db.delete(portalUsers).where(eq(portalUsers.id, userId));
  await logAudit({
    documentKind: "client",
    documentId: clientId,
    action: "portal_revoked",
    detail: `Portal user ${userId}`,
  });
  revalidatePath(`/clients/${clientId}`);
  redirect(flashUrl(`/clients/${clientId}`, "Portal access revoked", "success"));
}
