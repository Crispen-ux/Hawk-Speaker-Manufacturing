import Link from "next/link";
import { requireActivePortalUser } from "@/lib/auth-portal";
import { getPortalNotifications } from "@/lib/portal-data";
import { portalMarkNotificationRead, portalMarkAllNotificationsRead } from "@/lib/actions/portal";
import { PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const LEVEL_STYLES: Record<string, string> = {
  info: "bg-sky-50 text-sky-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-100 text-red-700",
};

function docHref(kind: string | null, id: number | null): string | null {
  if (!kind || !id) return null;
  if (kind === "invoice" || kind === "quotation" || kind === "receipt") return `/portal/${kind === "invoice" ? "invoices" : kind === "quotation" ? "quotations" : "receipts"}/${id}`;
  return null;
}

export default async function PortalNotificationsPage() {
  const session = await requireActivePortalUser();
  const notifications = await getPortalNotifications(session.clientId, 100);
  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);

  return (
    <div>
      <PageHeader
        eyebrow="Client portal"
        title="Notifications"
        action={
          unread.length > 0 ? (
            <form action={portalMarkAllNotificationsRead}>
              <button className="rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper-dim">
                Mark all as read
              </button>
            </form>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState title="No notifications" hint="Updates about your invoices, quotations and other documents will appear here." />
      ) : (
        <div className="space-y-2.5">
          {unread.length > 0 && (
            <div className="space-y-2.5">
              {unread.map((n) => (
                <NotificationRow key={n.id} notification={n} />
              ))}
            </div>
          )}
          {read.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationRow({ notification: n }: { notification: { id: number; title: string; message: string | null; level: string; read: boolean; createdAt: Date; documentKind: string | null; documentId: number | null } }) {
  const href = docHref(n.documentKind, n.documentId);
  const body = (
    <div className={`flex items-start justify-between gap-4 rounded-md border px-4 py-3 ${n.read ? "border-rule bg-white" : "border-forest/30 bg-white"}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-forest" aria-hidden="true" />}
          <p className={`text-sm font-medium ${n.read ? "text-ink-soft" : "text-ink"}`}>{n.title}</p>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${LEVEL_STYLES[n.level] ?? LEVEL_STYLES.info}`}>{n.level}</span>
        </div>
        {n.message && <p className={`mt-0.5 text-xs ${n.read ? "text-ink-soft/70" : "text-ink-soft"}`}>{n.message}</p>}
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft/60">{new Date(n.createdAt).toLocaleString()}</p>
      </div>
      {!n.read && (
        <form action={portalMarkNotificationRead.bind(null, n.id)}>
          <button className="shrink-0 text-xs font-medium text-forest hover:underline">Mark read</button>
        </form>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}