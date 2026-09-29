import { createContract } from "@/lib/actions/hr";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSettings } from "@/lib/numbering";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewContractPage() {
  const settings = await getSettings();
  const people = await db
    .select()
    .from(employees)
    .where(eq(employees.status, "active"))
    .orderBy(employees.lastName, employees.firstName);

  return (
    <div>
      <PageHeader eyebrow="People operations" title="Add contract" />
      <Card className="max-w-2xl">
        <form action={createContract} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Employee">
              <select name="employeeId" required className={inputClass}>
                <option value="">— Choose —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select name="type" defaultValue="permanent" className={inputClass}>
                {[
                  ["permanent", "Permanent"],
                  ["fixed_term", "Fixed term"],
                  ["intern", "Intern"],
                  ["part_time", "Part time"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start date">
              <input type="date" name="startDate" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
            </Field>
            <Field label="End date (if fixed term)">
              <input type="date" name="endDate" className={inputClass} />
            </Field>
            <Field label={`Hourly rate (${settings.currency || "R"})`}>
              <input name="hourlyRate" inputMode="decimal" defaultValue="0" className={inputClass} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea name="notes" rows={3} className={inputClass} />
          </Field>
          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Add contract</PrimaryButton>
            <GhostLink href="/hr">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}