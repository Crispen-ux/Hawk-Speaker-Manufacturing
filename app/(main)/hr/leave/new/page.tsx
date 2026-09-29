import { createLeave } from "@/lib/actions/hr";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewLeavePage() {
  const people = await db
    .select()
    .from(employees)
    .where(eq(employees.status, "active"))
    .orderBy(employees.lastName, employees.firstName);

  return (
    <div>
      <PageHeader eyebrow="People operations" title="Request leave" />
      <Card className="max-w-2xl">
        <form action={createLeave} className="space-y-5">
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
              <select name="type" defaultValue="annual" className={inputClass}>
                {["annual", "sick", "family", "unpaid"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From">
              <input type="date" name="fromDate" required className={inputClass} />
            </Field>
            <Field label="To">
              <input type="date" name="toDate" required className={inputClass} />
            </Field>
          </div>
          <Field label="Reason">
            <textarea name="reason" rows={3} className={inputClass} />
          </Field>
          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Request leave</PrimaryButton>
            <GhostLink href="/hr">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}