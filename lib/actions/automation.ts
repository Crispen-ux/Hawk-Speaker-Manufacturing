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

function validateAndParseConditions(conditionsJson: string): string | null {
  if (!conditionsJson) return null;
  const parsed = JSON.parse(conditionsJson);
  if (!Array.isArray(parsed) || parsed.some((c) => !c?.field || !c?.op || c?.value === undefined)) {
    throw new Error('Each condition needs field, operator and value.');
  }
  return JSON.stringify(parsed);
}

function validateAndParseSteps(stepsJson: string): Array<{ action: string; config: string; sortOrder: number }> {
  const parsed = JSON.parse(stepsJson);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Add at least one action.");
  }
  if (parsed.some((s) => !isAction((s as { action?: unknown })?.action))) {
    throw new Error("Each step needs a recognised action name.");
  }
  return parsed.map((s: { action: string; config?: unknown }, i) => ({
    action: s.action,
    config: JSON.stringify(s.config ?? {}),
    sortOrder: i,
  }));
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

  const conditions = validateAndParseConditions(conditionsJson);
  const steps = validateAndParseSteps(stepsJson);

  const [automation] = await db
    .insert(automations)
    .values({ name, description, trigger, conditions, enabled })
    .returning({ id: automations.id });

  await db.insert(automationSteps).values(
    steps.map((s) => ({ ...s, automationId: automation.id }))
  );

  revalidatePath("/automation");
}

export async function updateAutomation(formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const trigger = String(formData.get("trigger") ?? "");
  const conditionsJson = String(formData.get("conditions") ?? "").trim();
  const stepsJson = String(formData.get("steps") ?? "").trim();
  const enabled = formData.get("enabled") === "1";

  if (!Number.isFinite(id)) throw new Error("Invalid automation.");
  if (!name) throw new Error("Give the automation a name.");
  if (!isTrigger(trigger)) throw new Error("Pick a valid trigger event.");

  const conditions = validateAndParseConditions(conditionsJson);
  const steps = validateAndParseSteps(stepsJson);

  await db
    .update(automations)
    .set({ name, description, trigger, conditions, enabled, updatedAt: new Date() })
    .where(eq(automations.id, id));

  // Replace steps: delete old, insert new
  await db.delete(automationSteps).where(eq(automationSteps.automationId, id));
  await db.insert(automationSteps).values(
    steps.map((s) => ({ ...s, automationId: id }))
  );

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

  await db.delete(automations).where(eq(automations.id, id));
  revalidatePath("/automation");
}