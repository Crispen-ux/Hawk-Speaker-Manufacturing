"use server";

import { db } from "@/db";
import { opportunities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";
import { logAudit } from "@/lib/audit";
import { toNumber } from "@/lib/money";

const VALID_STAGES = ["new", "proposal", "negotiation", "won", "lost"] as const;

export async function createOpportunity(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const title = String(formData.get("title") ?? "").trim();
  const stage = String(formData.get("stage") ?? "new");
  const value = toNumber(String(formData.get("value") ?? "0"));
  const expectedCloseDate = String(formData.get("expectedCloseDate") ?? "") || null;
  const quotationId = formData.get("quotationId") ? Number(String(formData.get("quotationId"))) : null;
  const description = String(formData.get("description") ?? "") || null;

  if (!clientId) throw new Error("Client is required");
  if (!title) throw new Error("Title is required");

  const opportunityStage = (VALID_STAGES as readonly string[]).includes(stage) ? (stage as (typeof VALID_STAGES)[number]) : "new";

  const [row] = await db
    .insert(opportunities)
    .values({
      clientId,
      title,
      description,
      stage: opportunityStage,
      value: value.toFixed(2),
      expectedCloseDate,
      quotationId,
    })
    .returning({ id: opportunities.id });

  await logAudit({ documentKind: "opportunity", documentId: row.id, action: "created", detail: title });

  revalidatePath(`/clients/${clientId}`);
  redirect(flashUrl(`/clients/${clientId}`, "Opportunity added"));
}

export async function updateOpportunity(formData: FormData) {
  const id = Number(formData.get("id"));
  const clientId = Number(formData.get("clientId"));
  const title = String(formData.get("title") ?? "").trim();
  const stage = String(formData.get("stage") ?? "new");
  const value = toNumber(String(formData.get("value") ?? "0"));
  const expectedCloseDate = String(formData.get("expectedCloseDate") ?? "") || null;
  const quotationId = formData.get("quotationId") ? Number(String(formData.get("quotationId"))) : null;
  const description = String(formData.get("description") ?? "") || null;

  const opportunityStage = (VALID_STAGES as readonly string[]).includes(stage) ? (stage as (typeof VALID_STAGES)[number]) : "new";

  await db
    .update(opportunities)
    .set({
      title,
      description,
      stage: opportunityStage,
      value: value.toFixed(2),
      expectedCloseDate,
      quotationId,
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, id));

  await logAudit({ documentKind: "opportunity", documentId: id, action: "updated", detail: title });

  revalidatePath(`/clients/${clientId}`);
  redirect(flashUrl(`/clients/${clientId}`, "Opportunity updated"));
}

export async function setOpportunityStage(id: number, clientId: number, stage: (typeof VALID_STAGES)[number]) {
  await db.update(opportunities).set({ stage, updatedAt: new Date() }).where(eq(opportunities.id, id));
  await logAudit({ documentKind: "opportunity", documentId: id, action: "stage_changed", detail: stage });
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteOpportunity(id: number, clientId: number) {
  await db.delete(opportunities).where(eq(opportunities.id, id));
  await logAudit({ documentKind: "opportunity", documentId: id, action: "deleted", detail: String(id) });
  revalidatePath(`/clients/${clientId}`);
}
