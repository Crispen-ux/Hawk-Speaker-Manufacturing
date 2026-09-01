"use server";

import { db } from "@/db";
import { portalUsers, notifications, quotations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActivePortalUser, findPortalUserById, hashPortalPassword, verifyPortalPassword } from "@/lib/auth-portal";
import { approveQuotation, declineQuotation } from "@/lib/services/quotations";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/actions/notifications";
import { flashUrl } from "@/lib/flash";

/**
 * Server actions exposed to the client portal. Every action re-authenticates
 * the portal session and scopes its work to the authenticated client, so a
 * client can never reach another client's data.
 */

async function auth() {
  return requireActivePortalUser();
}

export async function portalApproveQuotation(formData: FormData) {
  const session = await auth();
  const quotationId = Number(formData.get("quotationId"));
  const comment = String(formData.get("comment") ?? "").trim();
  try {
    await approveQuotation(quotationId, {
      clientId: session.clientId,
      actorId: `portal:${session.email}`,
      comment,
    });
  } catch (e) {
    redirect(flashUrl(`/portal/quotations/${quotationId}`, e instanceof Error ? e.message : "Could not approve quotation", "error"));
  }
  revalidatePath(`/portal/quotations/${quotationId}`);
  revalidatePath("/portal");
  redirect(flashUrl(`/portal/quotations/${quotationId}`, "Quotation approved", "success"));
}

export async function portalDeclineQuotation(formData: FormData) {
  const session = await auth();
  const quotationId = Number(formData.get("quotationId"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    redirect(flashUrl(`/portal/quotations/${quotationId}`, "Please provide a reason for declining", "error"));
  }
  try {
    await declineQuotation(quotationId, {
      clientId: session.clientId,
      actorId: `portal:${session.email}`,
      reason,
    });
  } catch (e) {
    redirect(flashUrl(`/portal/quotations/${quotationId}`, e instanceof Error ? e.message : "Could not decline quotation", "error"));
  }
  revalidatePath(`/portal/quotations/${quotationId}`);
  revalidatePath("/portal");
  redirect(flashUrl(`/portal/quotations/${quotationId}`, "Quotation declined", "success"));
}

/** Records a "request changes" request — audited + notified, no status change. */
export async function portalRequestChanges(formData: FormData) {
  const session = await auth();
  const quotationId = Number(formData.get("quotationId"));
  const note = String(formData.get("note") ?? "").trim();
  const quote = await db.query.quotations.findFirst({ where: eq(quotations.id, quotationId) });
  if (!quote || quote.clientId !== session.clientId) {
    redirect(flashUrl("/portal/quotations", "Quotation not found", "error"));
  }
  if (!note) {
    redirect(flashUrl(`/portal/quotations/${quotationId}`, "Please describe the changes you need", "error"));
  }
  await logAudit({
    documentKind: "quotation",
    documentId: quotationId,
    documentNumber: quote.number,
    action: "changes_requested",
    detail: `by ${session.email} · ${note}`,
  });
  await notify({
    title: "Changes requested",
    message: `${session.name ?? session.email} requested changes on quotation ${quote.number}: ${note}`,
    documentKind: "quotation",
    documentId: quotationId,
    level: "info",
  });
  revalidatePath(`/portal/quotations/${quotationId}`);
  redirect(flashUrl(`/portal/quotations/${quotationId}`, "Changes requested", "success"));
}

export async function portalUpdateProfile(formData: FormData) {
  const session = await auth();
  const name = String(formData.get("name") ?? "").trim();
  await db.update(portalUsers).set({ name: name || null }).where(eq(portalUsers.id, session.portalUserId));
  revalidatePath("/portal/profile");
  redirect(flashUrl("/portal/profile", "Profile updated", "success"));
}

export async function portalChangePassword(formData: FormData) {
  const session = await auth();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  const user = await findPortalUserById(session.portalUserId);
  if (!user || !verifyPortalPassword(current, user.passwordHash)) {
    redirect(flashUrl("/portal/profile", "Current password is incorrect", "error"));
  }
  if (next.length < 8) {
    redirect(flashUrl("/portal/profile", "New password must be at least 8 characters", "error"));
  }
  if (next !== confirm) {
    redirect(flashUrl("/portal/profile", "New passwords do not match", "error"));
  }

  await db.update(portalUsers).set({ passwordHash: hashPortalPassword(next) }).where(eq(portalUsers.id, session.portalUserId));
  redirect(flashUrl("/portal/profile", "Password changed", "success"));
}

export async function portalMarkNotificationRead(notificationId: number) {
  await auth();
  await db.update(notifications).set({ read: true }).where(eq(notifications.id, notificationId));
  revalidatePath("/portal/notifications");
}

export async function portalMarkAllNotificationsRead() {
  await auth();
  await db.update(notifications).set({ read: true });
  revalidatePath("/portal/notifications");
}
