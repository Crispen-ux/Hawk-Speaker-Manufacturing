import Link from "next/link";
import { requireActivePortalUser } from "@/lib/auth-portal";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader, Card } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import {
  getPortalBalances,
  getPortalInvoices,
  getPortalQuotations,
  getPortalReceipts,
  getPortalNotifications,
} from "@/lib/portal-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard | Client portal" };

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-paper-dim text-ink-soft",
  sent: "bg-sky-50 text-sky-700",
  paid: "bg-emerald-50 text-emerald-700",
  partial: "bg-amber-50 text-amber-700",
  overdue: "bg-red-50 text-red-700",
  cancelled: "bg-paper-dim text-ink-soft",
  accepted: "bg-emerald-50 text-emerald-700",
  declined: "bg-red-50 text-red-700",
  expired: "bg-paper-dim text-ink-soft",
};

export default async function PortalDashboard() {
  const session = await requireActivePortalUser();
  const client = await db.query.clients.findFirst({ where: eq(clients.id, session.clientId) });
  const settings = await getSettings();
  const fmt = (n: string | number) => formatMoney(n, settings.currency || "R");

  const [balances, invoices, quotations, receipts, notifications] = await Promise.all([
    getPortalBalances(session.clientId),
    getPortalInvoices(session.clientId),
    getPortalQuotations(session.clientId),
    getPortalReceipts(session.clientId),
    getPortalNotifications(session.clientId, 20),
  ]);

  const openQuotations = quotations.filter((q) => !["accepted", "declined", "expired"].includes(q.status));
  const unpaidInvoices = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled" && i.balance > 0);

  return (
    <div>
      <PageHeader
        eyebrow="Client portal"
        title={`Welcome, ${client?.name ?? session.name ?? "there"}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Outstanding balance" value={fmt(balances.outstanding)} />
        <StatCard label="Overdue" value={fmt(balances.overdue)} tone={balances.overdue > 0 ? "danger" : "default"} />
        <StatCard label="Open quotations" value={String(openQuotations.length)} />
        <StatCard label="Unpaid invoices" value={String(unpaidInvoices.length)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-navy">Open quotations</h2>
            <Link href="/portal/quotations" className="text-sm font-medium text-forest hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {openQuotations.length === 0 && <p className="text-sm text-ink-soft">No open quotations.</p>}
            {openQuotations.slice(0, 5).map((q) => (
              <Link
                key={q.id}
                href={`/portal/quotations/${q.id}`}
                className="flex items-center justify-between rounded-md border border-rule px-3 py-2.5 hover:border-forest/40"
              >
                <span className="text-sm font-medium text-ink">{q.number}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[q.status] ?? "bg-paper-dim text-ink-soft"}`}>
                  {q.status}
                </span>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-navy">Recent invoices</h2>
            <Link href="/portal/invoices" className="text-sm font-medium text-forest hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {invoices.length === 0 && <p className="text-sm text-ink-soft">No invoices yet.</p>}
            {invoices.slice(0, 5).map((inv) => (
              <Link
                key={inv.id}
                href={`/portal/invoices/${inv.id}`}
                className="flex items-center justify-between rounded-md border border-rule px-3 py-2.5 hover:border-forest/40"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{inv.number}</p>
                  <p className="text-xs text-ink-soft">{formatDate(inv.issueDate)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-navy">{fmt(inv.total)}</p>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[inv.status] ?? "bg-paper-dim text-ink-soft"}`}>
                    {inv.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-navy">Recent receipts</h2>
            <Link href="/portal/receipts" className="text-sm font-medium text-forest hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {receipts.length === 0 && <p className="text-sm text-ink-soft">No receipts yet.</p>}
            {receipts.slice(0, 5).map((r) => (
              <Link key={r.id} href={`/portal/receipts/${r.id}`} className="flex items-center justify-between rounded-md border border-rule px-3 py-2.5 hover:border-forest/40">
                <span className="text-sm font-medium text-ink">{r.number}</span>
                <span className="text-sm font-semibold text-navy">{fmt(r.amount)}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-navy">Notifications</h2>
            <Link href="/portal/notifications" className="text-sm font-medium text-forest hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2.5">
            {notifications.filter((n) => !n.read).slice(0, 5).length === 0 && (
              <p className="text-sm text-ink-soft">You&apos;re all caught up.</p>
            )}
            {notifications
              .filter((n) => !n.read)
              .slice(0, 5)
              .map((n) => (
                <div key={n.id} className="rounded-md border border-rule px-3 py-2.5">
                  <p className="text-sm font-medium text-ink">{n.title}</p>
                  {n.message && <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{n.message}</p>}
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <Card className={tone === "danger" ? "!border-red-200" : ""}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">{label}</p>
      <p className={`mt-2 font-display text-2xl font-extrabold ${tone === "danger" ? "text-red-600" : "text-navy"}`}>
        {value}
      </p>
    </Card>
  );
}