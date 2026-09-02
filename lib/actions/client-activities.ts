"use server";

import { db } from "@/db";
import { clientActivities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";
import { logAudit } from "@/lib/audit";

export async function addClientActivity(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const type = String(formData.get("type") ?? "manual");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "") || null;

  if (!clientId) throw new Error("Client is required");
  if (!title) throw new Error("Title is required");

  const validTypes = ["call", "note", "meeting", "follow_up", "manual"] as const;
  const activityType = validTypes.includes(type as (typeof validTypes)[number]) ? (type as (typeof validTypes)[number]) : "manual";

  const [row] = await db
    .insert(clientActivities)
    .values({
      clientId,
      type: activityType,
      title,
      description,
      auto: false,
    })
    .returning({ id: clientActivities.id });

  await logAudit({ documentKind: "clientActivity", documentId: row.id, action: "created", detail: title });

  revalidatePath(`/clients/${clientId}`);
  redirect(flashUrl(`/clients/${clientId}`, "Activity logged"));
}

export async function deleteClientActivity(id: number, clientId: number) {
  await db.delete(clientActivities).where(eq(clientActivities.id, id));
  revalidatePath(`/clients/${clientId}`);
}
