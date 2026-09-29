import { createPayrollRun } from "@/lib/actions/payroll";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export default async function NewPayrollRunPage() {
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");
  const active = await db.select().from(employees).where(eq(employees.status, "active")).orderBy(employees.lastName, employees.firstName);
  const gross = active.reduce((s, e) => s + Number(e.salary || 0), 0);

  return (
    <div>
      <PageHeader eyebrow="Salaries" title="New payroll run" />
      <Card className="max-w-2xl">
        <form action={createPayrollRun} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Period start">
              <input type="date" name="periodStart" required className={inputClass} />
            </Field>
            <Field label="Period end">
              <input type="date" name="periodEnd" required className={inputClass} />
            </Field>
            <Field label="Pay date">
              <input type="date" name="payDate" required className={inputClass} />
            </Field>
          </div>
          {active.length > 0 ? (
            <div className="rounded-lg border border-rule bg-paper-dim/60 p-4 text-sm text-ink-soft">
              This run will include <span className="font-semibold text-ink">{active.length}</span> active employees at a
              gross total of <span className="font-semibold text-ink">{money(gross)}</span>.
            </div>
          ) : (
            <div className="rounded-lg border border-rust/40 bg-rust/10 p-4 text-sm text-rust">
              No active employees yet — add employees first so they can be paid.
            </div>
          )}
          <Field label="Notes">
            <textarea name="notes" rows={3} className={inputClass} />
          </Field>
          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit" disabled={active.length === 0}>
              Create run
            </PrimaryButton>
            <GhostLink href="/payroll">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}