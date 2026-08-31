import { notFound } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { PageHeader, Card, Field, inputClass, PrimaryButton, GhostLink } from "@/components/ui";
import { setUserActive, setUserRole, resetUserPassword } from "@/lib/actions/users";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const current = await requireAdmin();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const user = rows[0];
  if (!user) notFound();

  const isSelf = user.id === current.id;

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title={user.name || user.email}
        action={<GhostLink href="/users">Back to users</GhostLink>}
      />
      <div className="grid max-w-3xl gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-display text-lg font-bold text-navy">Account</h2>
          <div className="space-y-4">
            <Field label="Email">
              <input value={user.email} readOnly className={`${inputClass} bg-paper-dim`} />
            </Field>
            <form action={setUserRole} className="space-y-3">
              <input type="hidden" name="id" value={user.id} />
              <Field label="Role">
                <select name="role" defaultValue={user.role} className={inputClass} disabled={isSelf}>
                  <option value="staff">Staff — manages records</option>
                  <option value="admin">Admin — full access</option>
                </select>
              </Field>
              {!isSelf && (
                <div className="flex justify-end">
                  <PrimaryButton type="submit">Save role</PrimaryButton>
                </div>
              )}
            </form>
            <form action={setUserActive} className={isSelf ? "opacity-50" : ""}>
              <input type="hidden" name="id" value={user.id} />
              <input type="hidden" name="active" value={user.active ? "0" : "1"} />
              <button
                type="submit"
                disabled={isSelf}
                className={`w-full rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                  user.active
                    ? "border border-rust/40 bg-rust/5 text-rust hover:bg-rust/10"
                    : "bg-forest text-paper hover:bg-forest-2"
                }`}
              >
                {user.active ? "Disable account" : "Re-enable account"}
              </button>
              {isSelf && <p className="mt-2 text-xs text-ink-soft">You can&apos;t disable or demote your own account.</p>}
            </form>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 font-display text-lg font-bold text-navy">Reset password</h2>
          <p className="mb-4 text-sm text-ink-soft">
            Set a known password for this user. They can still use the self-service reset link from the sign-in page.
          </p>
          <form action={resetUserPassword} className="space-y-3">
            <input type="hidden" name="id" value={user.id} />
            <Field label="New password">
              <input name="password" type="password" required minLength={8} className={inputClass} placeholder="At least 8 characters" />
            </Field>
            <div className="flex justify-end">
              <PrimaryButton type="submit">Set password</PrimaryButton>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
