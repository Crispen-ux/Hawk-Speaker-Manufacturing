import Link from "next/link";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/money";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions/notifications";
import { routeForDocument } from "@/lib/audit";

export const dynamic = "force-dynamic";

const LEVEL_DOT: Record<string, string> = {
  info: "bg-forest-2",
  success: "bg-success",
  warning: "bg-amber-500",
  danger: "bg-rust",
};

export default async function NotificationsPage() {
  const rows = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(200);
  const unread = rows.filter((r) => !r.read).length;
  const markAll = markAllNotificationsRead.bind(null);

  return (
    <div>
      <PageHeader
        eyebrow="Alerts"
        title="Notifications"
        action={
          unread > 0 && (
            <form action={markAll}>
              <button className="font-mono text-xs uppercase tracking-wide text-forest hover:underline">
                Mark all as read ({unread})
              </button>
            </form>
          )
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="Nothing yet" hint="Events like payments received and leave decisions will show up here." />
      ) : (
        <div className="space-y-2">
          {rows.map((n) => {
            const href = n.documentKind && n.documentId ? routeForDocument(n.documentKind, n.documentId) : null;
            const markRead = markNotificationRead.bind(null, n.id);
            const body = (
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT[n.level] ?? "bg-forest-2"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className={`text-sm ${n.read ? "text-ink-soft" : "font-semibold text-ink"}`}>{n.title}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-ink-soft">
                      {formatDate(n.createdAt.toISOString())}
                    </span>
                  </div>
                  {n.message ? <p className="mt-0.5 text-xs text-ink-soft">{n.message}</p> : null}
                </div>
                {!n.read && (
                  <form action={markRead}>
                    <button className="font-mono text-[10px] uppercase tracking-wide text-forest hover:underline">
                      Mark read
                    </button>
                  </form>
                )}
              </div>
            );
            return (
              <div
                key={n.id}
                className={`rounded-lg border p-4 ${n.read ? "border-rule bg-paper" : "border-forest/40 bg-paper-dim/50"}`}
              >
                {href ? (
                  <Link href={href} className="block hover:opacity-90">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}