"use server";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sendPushNotification } from "@/lib/push";
import { getSettings } from "@/lib/numbering";
import { routeForDocument } from "@/lib/audit";
import { getBaseUrl } from "@/lib/base-url";
import { sendEmail } from "@/lib/email";

export type NotificationLevel = "info" | "success" | "warning" | "danger";

/**
 * The single place that turns a business event into an alert. It records the
 * in-app notification (the notification centre), then fans out — without
 * blocking the calling business flow — to:
 *   1. Web Push, to every subscribed browser/device.
 *   2. Email, to the company inbox (Settings → Email), gated by the
 *      `emailNotifications` setting ('off' | 'all' | 'warning').
 *
 * Every failure is swallowed below: notifications must never be able to take
 * down the business action that produced them.
 */
export async function notify(input: {
  title: string;
  message?: string;
  documentKind?: string;
  documentId?: number;
  level?: NotificationLevel;
}) {
  await db.insert(notifications).values({
    title: input.title,
    message: input.message ?? null,
    documentKind: input.documentKind ?? null,
    documentId: input.documentId ?? null,
    level: input.level ?? "info",
  });

  void fanOutNotifications(input);
}

async function fanOutNotifications(input: {
  title: string;
  message?: string;
  documentKind?: string;
  documentId?: number;
  level?: NotificationLevel;
}) {
  const baseUrl = getBaseUrl();
  const rel = input.documentKind && input.documentId ? routeForDocument(input.documentKind, input.documentId) : null;
  const url = baseUrl && rel ? `${baseUrl}${rel}` : undefined;

  // 1) Browser push — fire and forget.
  void sendPushNotification({ title: input.title, body: input.message, url }).catch((e) =>
    console.error("[notify] push fan-out failed", e)
  );

  // 2) Email copy to the company inbox — fire and forget.
  void (async () => {
    try {
      const settings = await getSettings();
      const mode = settings.emailNotifications ?? "all";
      if (mode === "off") return;
      const level = input.level ?? "info";
      if (mode === "warning" && !(level === "warning" || level === "danger")) return;
      const to = settings.email;
      if (!to) return;

      const companyName = settings.companyName || "App";
      const kindLabel = {
        info: "Info",
        success: "Success",
        warning: "Warning",
        danger: "Attention",
      }[level];

      const linkHtml = url
        ? `<p style="margin:24px 0 0; font-family:Arial,Helvetica,sans-serif;">
             <a href="${url}" style="display:inline-block; background-color:#1F8A5A; color:#ffffff; text-decoration:none; padding:12px 22px; border-radius:6px; font-size:14px; font-weight:bold;">View in app</a>
           </p>`
        : "";

      await sendEmail({
        to,
        subject: `${kindLabel} — ${input.title}`,
        html: `<!DOCTYPE html>
<html lang="en"><body style="margin:0; padding:0; background:#F7F8FA;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px; max-width:100%; background:#ffffff; border:1px solid #E2E5EA; border-radius:8px;">
        <tr><td style="padding:24px 32px; background-color:#0E2A47; border-radius:8px 8px 0 0;">
          <span style="font-family:Arial,Helvetica,sans-serif; font-size:16px; font-weight:bold; color:#ffffff;">${escapeHtml(companyName)}</span>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 6px; font-family:Arial,Helvetica,sans-serif; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#5B6472;">${kindLabel} notification</p>
          <h1 style="margin:0 0 14px; font-family:Arial,Helvetica,sans-serif; font-size:20px; color:#0E2A47;">${escapeHtml(input.title)}</h1>
          ${
            input.message
              ? `<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:1.6; color:#16212E;">${escapeHtml(input.message).replace(/\n/g, "<br/>")}</p>`
              : ""
          }
          ${linkHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
      });
    } catch (e) {
      console.error("[notify] email fan-out failed", e instanceof Error ? e.message : e);
    }
  })();
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function markNotificationRead(id: number) {
  await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  await db.update(notifications).set({ read: true });
  revalidatePath("/notifications");
}