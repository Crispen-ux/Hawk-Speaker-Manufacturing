import { db } from "@/db";
import { automations, automationSteps, automationRuns, automationRunSteps } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { BusinessEvent } from "@/lib/events";
import type { AutomationCondition, AutomationContext } from "./types";
import { getActionExecutor, isActionModuleAvailable } from "./actions";
import { getEnabledModules } from "@/lib/enabled-modules";
import { logAudit } from "@/lib/audit";
import { ensureDefaultAutomations } from "./seed";

/**
 * The automation engine. Given a business event it:
 *   1. bails out if the automation module is disabled
 *   2. loads every enabled automation whose trigger matches the event
 *   3. skips already-processed events (idempotency — never runs twice)
 *   4. evaluates each automation's conditions
 *   5. executes its actions in order, recording run + step outcomes
 *
 * The engine is deliberately generic: triggers, conditions and actions come
 * from registries, so new capabilities are additions, not rewrites.
 */

async function evaluateConditions(
  conditionsJson: string | null,
  source: Record<string, unknown>
): Promise<boolean> {
  if (!conditionsJson) return true;
  let conditions: AutomationCondition[];
  try {
    conditions = JSON.parse(conditionsJson);
  } catch {
    return true; // malformed conditions don't block execution
  }
  if (!Array.isArray(conditions) || conditions.length === 0) return true;

  const get = (field: string): unknown => {
    if (field === "amount") return source.amount;
    if (field === "status") return source.status;
    if (field === "customer") return source.customer;
    if (field === "supplier") return source.supplier;
    if (field === "clientId") return source.clientId;
    return source[field];
  };

  return conditions.every((c) => {
    const actual = get(c.field);
    if (actual === undefined) return false;
    switch (c.op) {
      case "eq":
        return String(actual) === String(c.value);
      case "neq":
        return String(actual) !== String(c.value);
      case "gt":
        return Number(actual) > Number(c.value);
      case "gte":
        return Number(actual) >= Number(c.value);
      case "lt":
        return Number(actual) < Number(c.value);
      case "lte":
        return Number(actual) <= Number(c.value);
      case "in":
        return Array.isArray(c.value) && c.value.map(String).includes(String(actual));
      case "contains":
        return String(actual).toLowerCase().includes(String(c.value).toLowerCase());
      default:
        return true;
    }
  });
}

export async function executeAutomationsForEvent(event: BusinessEvent): Promise<void> {
  const enabledModules = await getEnabledModules();
  // The whole automation area can be switched off from Settings → Modules.
  if (enabledModules["automation"] === false) return;

  await ensureDefaultAutomations();

  const candidates = await db
    .select()
    .from(automations)
    .where(and(eq(automations.trigger, event.event), eq(automations.enabled, true)));

  for (const automation of candidates) {
    await runAutomation(automation.id, event, enabledModules);
  }
}

async function runAutomation(
  automationId: number,
  event: BusinessEvent,
  enabledModules: Record<string, boolean>
): Promise<void> {
  const [automation, steps] = await Promise.all([
    db.select().from(automations).where(eq(automations.id, automationId)).limit(1).then((r) => r[0]),
    db
      .select()
      .from(automationSteps)
      .where(eq(automationSteps.automationId, automationId))
      .orderBy(automationSteps.sortOrder),
  ]);
  if (!automation) return;

  // Idempotency: this exact event must not be processed by this automation twice.
  const existing = await db
    .select({ id: automationRuns.id })
    .from(automationRuns)
    .where(and(eq(automationRuns.automationId, automationId), eq(automationRuns.eventId, event.id)))
    .limit(1);
  if (existing.length > 0) return;

  const source: Record<string, unknown> = { ...event.data, eventId: event.id, entityId: event.entityId };
  const ctx: AutomationContext = {
    event,
    enabledModules,
    source,
    entityType: event.entityType,
    entityId: event.entityId,
    entityNumber: event.entityNumber,
  };

  // Conditions
  const passes = await evaluateConditions(automation.conditions, source);
  if (!passes) {
    // Record the skipped attempt so the log explains why nothing happened.
    await recordRun(automationId, event, "completed", `Conditions not met`, []);
    return;
  }

  await logAudit({
    documentKind: "automation",
    documentId: automationId,
    documentNumber: `run:${event.id}`,
    action: "automation_run",
    detail: `trigger ${event.event} · entity ${event.entityType} ${event.entityId}`,
  });

  const startedAt = new Date();
  const [runRow] = await db
    .insert(automationRuns)
    .values({
      automationId,
      eventId: event.id,
      trigger: event.event,
      entityType: event.entityType,
      entityId: event.entityId || null,
      entityNumber: event.entityNumber ?? null,
      status: "run",
      startedAt,
    })
    .returning({ id: automationRuns.id });

  const stepResults: Array<{ action: string; status: string; detail: string | null }> = [];
  let failed = false;

  for (const step of steps) {
    const executor = getActionExecutor(step.action as any);
    const moduleAvailable = isActionModuleAvailable(step.action as any, enabledModules);
    if (!moduleAvailable) {
      stepResults.push({
        action: step.action,
        status: "skipped",
        detail: `Module disabled — action unavailable`,
      });
      continue;
    }
    try {
      const config = step.config ? JSON.parse(step.config) : {};
      // Resolve {{tokens}} in config against the shared source before running.
      const result = await executor.execute(config, ctx);
      if (result.refs) Object.assign(source, result.refs);
      stepResults.push({
        action: step.action,
        status: result.ok ? "success" : "failed",
        detail: result.detail ?? null,
      });
      if (!result.ok) failed = true;
    } catch (e) {
      failed = true;
      stepResults.push({
        action: step.action,
        status: "failed",
        detail: e instanceof Error ? e.message : "Unexpected action failure",
      });
    }
  }

  if (stepResults.length > 0) {
    await db.insert(automationRunSteps).values(
      stepResults.map((s, i) => ({
        runId: runRow.id,
        action: s.action,
        status: s.status,
        detail: s.detail,
        sortOrder: i,
      }))
    );
  }

  await db
    .update(automationRuns)
    .set({ status: failed ? "failed" : "completed", completedAt: new Date() })
    .where(eq(automationRuns.id, runRow.id));
}

async function recordRun(
  automationId: number,
  event: BusinessEvent,
  status: "run" | "failed" | "completed",
  detail: string,
  steps: Array<{ action: string; status: string; detail: string | null }>
): Promise<void> {
  const [runRow] = await db
    .insert(automationRuns)
    .values({
      automationId,
      eventId: event.id,
      trigger: event.event,
      entityType: event.entityType,
      entityId: event.entityId || null,
      entityNumber: event.entityNumber ?? null,
      status,
      startedAt: new Date(),
      completedAt: new Date(),
      error: detail === "Conditions not met" ? null : detail,
    })
    .returning({ id: automationRuns.id });
  if (steps.length > 0) {
    await db.insert(automationRunSteps).values(
      steps.map((s, i) => ({ runId: runRow.id, action: s.action, status: s.status, detail: s.detail, sortOrder: i }))
    );
  }
}
