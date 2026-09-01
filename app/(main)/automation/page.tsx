import { db } from "@/db";
import { automations, automationSteps, automationRuns, automationRunSteps } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { AUTOMATION_TRIGGERS, AUTOMATION_ACTIONS } from "@/lib/automation/types";
import { createAutomation, toggleAutomation, deleteAutomation } from "@/lib/actions/automation";
import { PageHeader, Card, EmptyState, Field, inputClass, PrimaryButton } from "@/components/ui";

export const dynamic = "force-dynamic";

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

const STEPS_SAMPLE = `[{ "action": "createNotification", "config": { "title": "Quotation approved", "message": "Invoice created" } }]`;
const CONDITIONS_SAMPLE = `[{ "field": "status", "op": "eq", "value": "accepted" }]`;

export default async function AutomationPage() {
  await requireAdmin();

  const [autoRows, runRows, stepsRows, runStepRows] = await Promise.all([
    db.select().from(automations).orderBy(desc(automations.id)),
    db.select().from(automationRuns).orderBy(desc(automationRuns.startedAt)).limit(30),
    db.select().from(automationSteps),
    db.select().from(automationRunSteps),
  ]);

  const stepsByAutomation = new Map<number, typeof stepsRows>();
  for (const s of stepsRows) {
    const list = stepsByAutomation.get(s.automationId) ?? [];
    list.push(s);
    stepsByAutomation.set(s.automationId, list);
  }
  for (const list of stepsByAutomation.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

  const autoById = new Map(autoRows.map((a) => [a.id, a]));
  const stepsByRun = new Map<number, typeof runStepRows>();
  for (const s of runStepRows) {
    const list = stepsByRun.get(s.runId) ?? [];
    list.push(s);
    stepsByRun.set(s.runId, list);
  }

  return (
    <div>
      <PageHeader eyebrow="Workflows" title="Automation" />
      <p className="-mt-5 mb-6 max-w-2xl text-sm text-ink-soft">
        Event-driven workflows. When a trigger fires, the engine runs each enabled automation that matches,
        evaluates its conditions, then executes its steps in order — logging every run so the outcome is auditable.
      </p>

      <h2 className="mb-3 font-display text-lg font-bold text-navy">Workflows</h2>
      {autoRows.length === 0 ? (
        <EmptyState
          title="No automations yet"
          hint="Create your first workflow below. The built-in “Convert Approved Quotations” workflow is seeded automatically when the first matching event fires."
        />
      ) : (
        <div className="space-y-3">
          {autoRows.map((a) => {
            const steps = stepsByAutomation.get(a.id) ?? [];
            const rawConditions = parseJson(a.conditions);
            const conditionsJson =
              Array.isArray(rawConditions) && rawConditions.length > 0 ? JSON.stringify(rawConditions) : null;
            const runCount = runRows.filter((r) => r.automationId === a.id).length;
            return (
              <Card key={a.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base font-bold text-ink">{a.name}</span>
                      <span className="rounded bg-paper-dim px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-soft">
                        {a.trigger}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                          a.enabled ? "bg-emerald/10 text-emerald" : "bg-paper-dim text-ink-soft"
                        }`}
                      >
                        {a.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    {a.description && <p className="mt-1 text-sm text-ink-soft">{a.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <form action={toggleAutomation}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="enabled" value={a.enabled ? "0" : "1"} />
                      <button
                        type="submit"
                        className="rounded-md border border-rule-strong px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-paper-dim"
                      >
                        {a.enabled ? "Disable" : "Enable"}
                      </button>
                    </form>
                    <form action={deleteAutomation}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-rust/30 px-3 py-1.5 text-xs font-medium text-rust transition-colors hover:bg-rust/10"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>

                {steps.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {steps.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-2">
                        {i > 0 && <span className="text-xs text-ink-soft">→</span>}
                        <span className="rounded border border-rule bg-paper-dim/60 px-2 py-1 font-mono text-[11px] text-ink">
                          {s.action}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {conditionsJson && (
                  <p className="mt-3 text-xs text-ink-soft">
                    Conditions: <code className="rounded bg-paper-dim px-1 font-mono">{conditionsJson}</code>
                  </p>
                )}
                {runCount > 0 && <p className="mt-3 text-xs text-ink-soft">{runCount} run(s) in the recent log.</p>}
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-8">
        <h2 className="mb-1 font-display text-lg font-bold text-navy">New workflow</h2>
        <p className="mb-5 text-xs text-ink-soft">
          Steps run in the order listed. You can reference event data in configs with{" "}
          <code className="rounded bg-paper-dim px-1 font-mono text-[11px]">{"{{placeholders}}"}</code> like{" "}
          <code className="rounded bg-paper-dim px-1 font-mono text-[11px]">{"{{invoiceId}}"}</code>.
        </p>
        <form action={createAutomation} className="max-w-2xl space-y-5">
          <Field label="Name">
            <input name="name" required className={inputClass} placeholder="e.g. Notify me on low stock" />
          </Field>
          <Field label="Trigger event">
            <select name="trigger" defaultValue="quotation.approved" className={inputClass}>
              {AUTOMATION_TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description (optional)">
            <textarea name="description" rows={2} className={inputClass} />
          </Field>
          <Field label={`Conditions (JSON, optional) — e.g. ${CONDITIONS_SAMPLE}`}>
            <textarea name="conditions" rows={3} className={inputClass} placeholder={CONDITIONS_SAMPLE} />
          </Field>
          <Field label={`Steps (JSON) — e.g. ${STEPS_SAMPLE}`}>
            <textarea name="steps" rows={5} required className={inputClass} placeholder={STEPS_SAMPLE} />
          </Field>
          <label className="flex items-center gap-3 text-sm text-ink">
            <input type="checkbox" name="enabled" defaultChecked className="h-4 w-4 accent-navy" />
            Enable immediately
          </label>
          <PrimaryButton type="submit">Create workflow</PrimaryButton>
        </form>
      </Card>

      <h2 className="mt-10 mb-3 font-display text-lg font-bold text-navy">Recent runs</h2>
      {runRows.length === 0 ? (
        <EmptyState title="No runs yet" hint="Runs appear here whenever a trigger fires and an automation processes the event." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Workflow</th>
                <th className="px-4 py-2.5 font-medium">Entity</th>
                <th className="px-4 py-2.5 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {runRows
                .filter((r) => autoById.has(r.automationId))
                .map((r) => (
                  <tr key={r.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-ink-soft">
                      {r.startedAt.toLocaleString("en-ZA", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-ink">{autoById.get(r.automationId)?.name}</td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      {r.trigger}
                      {r.entityNumber ? (
                        <span className="ml-1 font-mono text-xs text-ink-soft">{r.entityNumber}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                            r.status === "completed"
                              ? "bg-emerald/10 text-emerald"
                              : r.status === "failed"
                                ? "bg-rust/10 text-rust"
                                : "bg-paper-dim text-ink-soft"
                          }`}
                        >
                          {r.status}
                        </span>
                        {r.error && <span className="text-xs text-rust">{r.error}</span>}
                      </div>
                      {stepsByRun.get(r.id)?.length ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {(stepsByRun.get(r.id) ?? []).map((s) => (
                            <span
                              key={s.id}
                              className={`rounded border border-rule px-1.5 py-0.5 font-mono text-[10px] ${
                                s.status === "success"
                                  ? "text-emerald"
                                  : s.status === "failed"
                                    ? "text-rust"
                                    : "text-ink-soft"
                              }`}
                            >
                              {s.action}
                              {s.detail ? <span className="normal-case text-ink-soft"> — {s.detail}</span> : null}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <Card className="mt-8">
        <h2 className="mb-4 font-display text-lg font-bold text-navy">Reference</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Triggers</p>
            <div className="flex flex-wrap gap-1.5">
              {AUTOMATION_TRIGGERS.map((t) => (
                <span key={t} className="rounded bg-paper-dim px-2 py-1 font-mono text-[11px] text-ink">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Actions</p>
            <div className="flex flex-wrap gap-1.5">
              {AUTOMATION_ACTIONS.map((a) => (
                <span key={a} className="rounded bg-paper-dim px-2 py-1 font-mono text-[11px] text-ink">
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}