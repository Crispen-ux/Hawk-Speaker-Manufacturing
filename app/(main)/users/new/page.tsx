import { requireAdmin } from "@/lib/auth";
import { createUser } from "@/lib/actions/users";
import { PageHeader, Card, Field, inputClass, PrimaryButton, GhostLink } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  await requireAdmin();

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Add user" action={<GhostLink href="/users">Back to users</GhostLink>} />
      <Card className="max-w-xl">
        <form action={createUser} className="space-y-5">
          <Field label="Email">
            <input name="email" type="email" required className={inputClass} placeholder="name@company.com" />
          </Field>
          <Field label="Name">
            <input name="name" type="text" className={inputClass} placeholder="Full name (optional)" />
          </Field>
          <Field label="Password">
            <input name="password" type="password" required minLength={8} className={inputClass} placeholder="At least 8 characters" />
          </Field>
          <Field label="Role">
            <select name="role" defaultValue="staff" className={inputClass}>
              <option value="staff">Staff — manages records</option>
              <option value="admin">Admin — full access</option>
            </select>
          </Field>
          <div className="flex justify-end">
            <PrimaryButton type="submit">Create user</PrimaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
