import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Web Push (browser notifications) via VAPID. Subscriptions live in the
 * `push_subscriptions` table; every `notify()` fan-out delivers a push to all
 * of them. VAPID keys come from env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
 * VAPID_SUBJECT (mailto:…). The client needs NEXT_PUBLIC_VAPID_PUBLIC_KEY.
 */

type VapidConfig = { publicKey: string; privateKey: string; subject: string };

function vapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
  };
}

export function isPushConfigured(): boolean {
  return vapidConfig() !== null;
}

export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values({
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
      },
    });
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/**
 * Sends a push notification to every subscribed browser. Failures are
 * contained per subscription; endpoints the push service reports as gone
 * (404/410) are removed so the table doesn't collect dead devices.
 */
export async function sendPushNotification(input: {
  title: string;
  body?: string;
  url?: string;
}): Promise<void> {
  const config = vapidConfig();
  if (!config) return;
  if (!input.title) return;

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const subs = await db.select().from(pushSubscriptions);
  if (subs.length === 0) return;

  const payload = JSON.stringify({
    title: input.title,
    body: input.body ?? "",
    url: input.url ?? "",
  });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (e) {
        const statusCode = (e as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
        } else {
          console.error("[push] delivery failed", statusCode ?? e);
        }
      }
    })
  );
}