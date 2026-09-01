import Link from "next/link";
import { requireActivePortalUser } from "@/lib/auth-portal";
import { getPortalInvoices } from "@/lib/portal-data";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/money";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-paper-dim text-ink-soft",
  sent: "bg-sky-50 text-sky-700",
  paid: "bg-emerald-50 text-emerald-700",
  partial: "bg-amber-50 text-amber-700",
  overdue: "bg-red-50 text-red-700",
  cancelled: "bg-paper-dim text-ink-soft",
};

export default async function PortalInvoicesPage() {
  const session = await requireActivePortalUser();
  const settings = await getSettings();
  const fmt = (n: string | number) => formatMoney(n, settings.currency || "R");
  const invoices = await getPortalInvoices(session.clientId);

  return (
    <div>
      <PageHeader eyebrow="Client portal" title="Invoices" />
      {invoices.length === 0 ? (
        <EmptyState title="No invoices" hint="Invoices raised for you will appear here." />
      ) : (
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-rule bg-paper-dim/60">
              <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-rule last:border-0 hover:bg-paper-dim/40">
                  <td className="px-4 py-3">
                    <Link href={`/portal/invoices/${inv.id}`} className="font-medium text-forest hover:underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(inv.issueDate)}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-right font-medium text-navy">{fmt(inv.total)}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(inv.balance)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[inv.status] ?? "bg-paper-dim text-ink-soft"}`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}