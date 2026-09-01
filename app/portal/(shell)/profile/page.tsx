import { requireActivePortalUser } from "@/lib/auth-portal";
import { db } from "@/db";
import { clients, portalUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader, Card, Field, inputClass } from "@/components/ui";
import { portalUpdateProfile, portalChangePassword } from "@/lib/actions/portal";
import { formatDate } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PortalProfilePage() {
  const session = await requireActivePortalUser();
  const [client, user] = await Promise.all([
    db.query.clients.findFirst({ where: eq(clients.id, session.clientId) }),
    db.query.portalUsers.findFirst({ where: eq(portalUsers.id, session.portalUserId) }),
  ]);
  if (!client || !user) return null;

  return (
    <div>
      <PageHeader eyebrow="Client portal" title="Profile" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-display text-base font-bold text-navy">Your organisation</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Company" value={client.name} />
            <Row label="Email" value={client.email ?? "—"} />
            <Row label="Phone" value={client.phone ?? "—"} />
            <Row label="Address" value={client.address ?? "—"} />
            <Row label="Registration" value={client.registrationNumber ?? "—"} />
            <Row label="VAT number" value={client.vatNumber ?? "—"} />
          </dl>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 font-display text-base font-bold text-navy">Your account</h2>
            <p className="mb-1 text-sm text-ink">Signed in as <span className="font-medium text-ink">{session.email}</span></p>
            {user.lastLoginAt && <p className="mb-4 text-xs text-ink-soft">Last login {formatDate(String(user.lastLoginAt))}</p>}
            <form action={portalUpdateProfile} className="space-y-3">
              <Field label="Display name">
                <input name="name" defaultValue={session.name ?? ""} className={inputClass} placeholder="Your name" />
              </Field>
              <button className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-navy-2">
                Update profile
              </button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-4 font-display text-base font-bold text-navy">Change password</h2>
            <form action={portalChangePassword} className="space-y-3">
              <Field label="Current password">
                <input name="currentPassword" type="password" autoComplete="current-password" className={inputClass} required />
              </Field>
              <Field label="New password">
                <input name="newPassword" type="password" autoComplete="new-password" className={inputClass} required minLength={8} />
              </Field>
              <Field label="Confirm new password">
                <input name="confirmPassword" type="password" autoComplete="new-password" className={inputClass} required />
              </Field>
              <button className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-navy-2">
                Change password
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 border-b border-rule pb-2 last:border-0 last:pb-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}