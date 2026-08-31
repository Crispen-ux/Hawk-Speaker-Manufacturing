import { db } from "@/db";
import { users } from "@/db/schema";
import { asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { PageHeader, Card, LinkButton, inputClass, PrimaryButton, Field } from "@/components/ui";
import { setUserActive, setUserRole, resetUserPassword } from "@/lib/actions/users";
import Link from "next/link";

export const dynamic = "force-dynamic";

function UserRow({ user, isSelf }: { user: { id: number; email: string; name: string | null; role: "admin" | "staff"; active: boolean }; isSelf: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-rule py-4 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link href={`/users/${user.id}`} className="truncate text-sm font-semibold text-ink hover:text-forest">
            {user.name || user.email}
          </Link>
          {isSelf && <span className="rounded bg-paper-dim px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-ink-soft">you</span>}
        </div>
        <div className="text-xs text-ink-soft">{user.email}</div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            user.role === "admin" ? "bg-forest/15 text-forest" : "bg-paper-dim text-ink-soft"
          }`}
        >
          {user.role}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            user.active ? "bg-emerald/10 text-emerald" : "bg-rust/10 text-rust"
          }`}
        >
          {user.active ? "Active" : "Disabled"}
        </span>
        <Link href={`/users/${user.id}`} className="text-sm font-medium text-forest hover:underline">
          Manage
        </Link>
      </div>
    </div>
  );
}

export default async function UsersPage() {
  const current = await requireAdmin();
  const rows = await db.select().from(users).orderBy(asc(users.email));

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        action={<LinkButton href="/users/new">Add user</LinkButton>}
      />
      <Card className="p-0">
        <div className="px-6 pt-5">
          <p className="text-sm text-ink-soft">
            {rows.length} user{rows.length === 1 ? "" : "s"} can sign in. Staff can create and manage records; only
            admins can change settings, users, and accounting.
          </p>
        </div>
        <div className="mt-2 px-6 pb-2">
          {rows.map((u) => (
            <UserRow
              key={u.id}
              user={{ id: u.id, email: u.email, name: u.name, role: u.role, active: u.active }}
              isSelf={u.id === current.id}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
