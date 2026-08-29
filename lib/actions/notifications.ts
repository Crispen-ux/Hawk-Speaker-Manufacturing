"use server";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type NotificationLevel = "info" | "success" | "warning" | "danger";

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
}

export async function markNotificationRead(id: number) {
  await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  await db.update(notifications).set({ read: true });
  revalidatePath("/notifications");
}