"use server";

import { db } from "@/db";
import { clientActivities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";
import { logAudit } from "@/lib/audit";

const VALID_TYPES = ["call", "note", "meeting", "follow_up", "manual"] as const;
const VALID_STATUSES = ["open", "done"] as const;

export async function addClientActivity(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const type = String(formData.get("type") ?? "manual");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "") || null;
  const status = String(formData.get("status") ?? "open");
  const dueDate = String(formData.get("dueDate") ?? "") || null;
  const assignedToId = formData.get("assignedToId") ? Number(formData.get("assignedToId")) : null;

  if (!clientId) throw new Error("Client is required");
  if (!title) throw new Error("Title is required");

  const activityType = (VALID_TYPES as readonly string[]).includes(type) ? (type as (typeof VALID_TYPES)[number]) : "manual";
  const activityStatus = (VALID_STATUSES as readonly string[]).includes(status) ? (status as (typeof VALID_STATUSES)[number]) : "open";

  const [row] = await db
    .insert(clientActivities)
    .values({
      clientId,
      type: activityType,
      title,
      description,
      status: activityStatus,
      dueDate,
      assignedToId,
      auto: false,
    })
    .returning({ id: clientActivities.id });

  await logAudit({ documentKind: "clientActivity", documentId: row.id, action: "created", detail: title });

  revalidatePath(`/clients/${clientId}`);
  redirect(flashUrl(`/clients/${clientId}`, "Activity logged"));
}

export async function setActivityStatus(id: number, clientId: number, status: (typeof VALID_STATUSES)[number]) {
  await db.update(clientActivities).set({ status }).where(eq(clientActivities.id, id));
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteClientActivity(id: number, clientId: number) {
  await db.delete(clientActivities).where(eq(clientActivities.id, id));
  revalidatePath(`/clients/${clientId}`);
}
