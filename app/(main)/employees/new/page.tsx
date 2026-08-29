import { createEmployee } from "@/lib/actions/employees";
import { getSettings } from "@/lib/numbering";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const settings = await getSettings();
  return (
    <div>
      <PageHeader eyebrow="People" title="Add employee" />
      <Card className="max-w-2xl">
        <form action={createEmployee} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name">
              <input name="firstName" required className={inputClass} placeholder="e.g. Thabo" />
            </Field>
            <Field label="Last name">
              <input name="lastName" required className={inputClass} placeholder="e.g. Moyo" />
            </Field>
            <Field label="Email">
              <input name="email" type="email" required className={inputClass} placeholder="name@company.co.za" />
            </Field>
            <Field label="Phone">
              <input name="phone" className={inputClass} placeholder="+27 …" />
            </Field>
            <Field label="Position">
              <input name="position" className={inputClass} placeholder="e.g. Electrician" />
            </Field>
            <Field label="Department">
              <input name="department" className={inputClass} placeholder="e.g. Projects" />
            </Field>
            <Field label="ID / passport number">
              <input name="idNumber" className={inputClass} placeholder="Optional" />
            </Field>
            <Field label="Start date">
              <input type="date" name="startDate" className={inputClass} />
            </Field>
          </div>
          <Field label={`Salary (${settings.currency || "R"})`}>
            <input name="salary" inputMode="decimal" defaultValue="0" className={inputClass} />
          </Field>
          <Field label="Notes">
            <textarea name="notes" rows={3} className={inputClass} />
          </Field>
          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Add employee</PrimaryButton>
            <GhostLink href="/employees">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}