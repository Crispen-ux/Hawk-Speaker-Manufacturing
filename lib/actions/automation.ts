"use server";

import { db } from "@/db";
import { automations, automationSteps } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { AUTOMATION_TRIGGERS, AUTOMATION_ACTIONS } from "@/lib/automation/types";

function isTrigger(v: unknown): v is (typeof AUTOMATION_TRIGGERS)[number] {
  return typeof v === "string" && (AUTOMATION_TRIGGERS as readonly string[]).includes(v);
}

function isAction(v: unknown): v is (typeof AUTOMATION_ACTIONS)[number] {
  return typeof v === "string" && (AUTOMATION_ACTIONS as readonly string[]).includes(v);
}

export async function createAutomation(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const trigger = String(formData.get("trigger") ?? "");
  const conditionsJson = String(formData.get("conditions") ?? "").trim();
  const stepsJson = String(formData.get("steps") ?? "").trim();
  const enabled = formData.get("enabled") === "1";

  if (!name) throw new Error("Give the automation a name.");
  if (!isTrigger(trigger)) throw new Error("Pick a valid trigger event.");

  let conditions: string | null = null;
  if (conditionsJson) {
    try {
      const parsed = JSON.parse(conditionsJson);
      if (!Array.isArray(parsed) || parsed.some((c) => !c?.field || !c?.op || c?.value === undefined)) {
        throw new Error();
      }
      conditions = JSON.stringify(parsed);
    } catch {
      throw new Error(
        'Conditions must be valid JSON, e.g. [{ "field": "status", "op": "eq", "value": "accepted" }]'
      );
    }
  }

  let steps: Array<{ action: string; config: string; sortOrder: number }> = [];
  if (stepsJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(stepsJson);
    } catch {
      throw new Error('Steps must be valid JSON, e.g. [{ "action": "createNotification", "config": {} }]');
    }
    if (!Array.isArray(parsed) || parsed.some((s) => !isAction((s as { action?: unknown })?.action))) {
      throw new Error("Each step needs a known action name.");
    }
    steps = parsed.map((s: { action: string; config?: unknown }, i) => ({
      action: s.action,
      config: JSON.stringify(s.config ?? {}),
      sortOrder: i,
    }));
  }

  const [automation] = await db
    .insert(automations)
    .values({ name, description, trigger, conditions, enabled })
    .returning({ id: automations.id });

  if (steps.length > 0) {
    await db.insert(automationSteps).values(
      steps.map((s) => ({ ...s, automationId: automation.id }))
    );
  }

  revalidatePath("/automation");
}

export async function toggleAutomation(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const enabled = formData.get("enabled") === "1";
  if (!Number.isFinite(id)) throw new Error("Invalid automation.");

  await db.update(automations).set({ enabled, updatedAt: new Date() }).where(eq(automations.id, id));
  revalidatePath("/automation");
}

export async function deleteAutomation(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) throw new Error("Invalid automation.");

  // Steps and run history are removed by the FK onDelete cascade.
  await db.delete(automations).where(eq(automations.id, id));
  revalidatePath("/automation");
}