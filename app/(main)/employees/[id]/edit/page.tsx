import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { employees } from "@/db/schema";
import { updateEmployee } from "@/lib/actions/employees";
import { getSettings } from "@/lib/numbering";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employeeId = Number(id);
  const settings = await getSettings();
  const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId));
  if (!employee) notFound();
  const update = updateEmployee.bind(null, employeeId);

  return (
    <div>
      <PageHeader eyebrow="People" title={`Edit ${employee.firstName} ${employee.lastName}`} />
      <Card className="max-w-2xl">
        <form action={update} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name">
              <input name="firstName" required defaultValue={employee.firstName} className={inputClass} />
            </Field>
            <Field label="Last name">
              <input name="lastName" required defaultValue={employee.lastName} className={inputClass} />
            </Field>
            <Field label="Email">
              <input name="email" type="email" required defaultValue={employee.email} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input name="phone" defaultValue={employee.phone ?? ""} className={inputClass} />
            </Field>
            <Field label="Position">
              <input name="position" defaultValue={employee.position ?? ""} className={inputClass} />
            </Field>
            <Field label="Department">
              <input name="department" defaultValue={employee.department ?? ""} className={inputClass} />
            </Field>
            <Field label="ID / passport number">
              <input name="idNumber" defaultValue={employee.idNumber ?? ""} className={inputClass} />
            </Field>
            <Field label="Start date">
              <input type="date" name="startDate" defaultValue={employee.startDate ?? ""} className={inputClass} />
            </Field>
          </div>
          <Field label={`Salary (${settings.currency || "R"})`}>
            <input name="salary" inputMode="decimal" defaultValue={employee.salary} className={inputClass} />
          </Field>
          <Field label="Notes">
            <textarea name="notes" rows={3} defaultValue={employee.notes ?? ""} className={inputClass} />
          </Field>
          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Save changes</PrimaryButton>
            <GhostLink href={`/employees/${employeeId}`}>Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}