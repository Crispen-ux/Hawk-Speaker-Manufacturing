import { db } from "@/db";
import { automations, automationSteps, automationRuns, automationRunSteps } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getEnabledModules } from "@/lib/enabled-modules";
import AutomationBuilder from "@/components/AutomationBuilder";

export const dynamic = "force-dynamic";

export default async function AutomationPage() {
  await requireAdmin();

  const [autoRows, stepRows, runRows, runStepRows, enabledModules] = await Promise.all([
    db.select().from(automations).orderBy(desc(automations.id)),
    db.select().from(automationSteps),
    db.select().from(automationRuns).orderBy(desc(automationRuns.startedAt)).limit(50),
    db.select().from(automationRunSteps),
    getEnabledModules(),
  ]);

  /* Build lookup maps */
  const stepsByAuto = new Map<number, typeof stepRows>();
  for (const s of stepRows) {
    const list = stepsByAuto.get(s.automationId) ?? [];
    list.push(s);
    stepsByAuto.set(s.automationId, list);
  }
  for (const list of stepsByAuto.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

  const stepsByRun = new Map<number, typeof runStepRows>();
  for (const s of runStepRows) {
    const list = stepsByRun.get(s.runId) ?? [];
    list.push(s);
    stepsByRun.set(s.runId, list);
  }

  const autoById = new Map(autoRows.map((a) => [a.id, a]));

  /* Compute run stats */
  let successful = 0;
  let failed = 0;
  for (const r of runRows) {
    if (r.status === "completed") successful++;
    else if (r.status === "failed") failed++;
  }

  /* Compute per-automation stats */
  const runCountByAuto = new Map<number, number>();
  const lastRunByAuto = new Map<number, typeof runRows[number]>();
  for (const r of runRows) {
    runCountByAuto.set(r.automationId, (runCountByAuto.get(r.automationId) ?? 0) + 1);
    if (!lastRunByAuto.has(r.automationId)) lastRunByAuto.set(r.automationId, r);
  }

  /* Serialize automations with pre-computed stats */
  const serialisedAutomations = autoRows.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    trigger: a.trigger,
    conditions: a.conditions,
    enabled: a.enabled,
    steps: (stepsByAuto.get(a.id) ?? []).map((s) => ({
      id: s.id,
      action: s.action,
      config: s.config,
      sortOrder: s.sortOrder,
    })),
    lastRunAt: lastRunByAuto.get(a.id)?.startedAt?.toISOString() ?? null,
    lastRunStatus: lastRunByAuto.get(a.id)?.status ?? null,
    runCount: runCountByAuto.get(a.id) ?? 0,
  }));

  /* Serialize runs */
  const serialisedRuns = runRows.map((r) => ({
    id: r.id,
    automationId: r.automationId,
    trigger: r.trigger,
    entityNumber: r.entityNumber,
    status: r.status,
    error: r.error,
    startedAt: r.startedAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    durationMs:
      r.completedAt && r.startedAt ? Math.max(0, r.completedAt.getTime() - r.startedAt.getTime()) : null,
    automationName: autoById.get(r.automationId)?.name ?? "Unknown",
    steps: (stepsByRun.get(r.id) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({
        id: s.id,
        action: s.action,
        status: s.status,
        detail: s.detail,
        sortOrder: s.sortOrder,
      })),
  }));

  return (
    <AutomationBuilder
      automations={serialisedAutomations}
      runs={serialisedRuns}
      enabledModules={enabledModules}
      stats={{
        active: autoRows.filter((a) => a.enabled).length,
        total: runRows.length,
        successful,
        failed,
      }}
    />
  );
}