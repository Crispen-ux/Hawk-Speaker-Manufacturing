import { requireActivePortalUser } from "@/lib/auth-portal";
import { getPortalPayments } from "@/lib/portal-data";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/money";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export default async function PortalPaymentsPage() {
  const session = await requireActivePortalUser();
  const settings = await getSettings();
  const fmt = (n: string | number) => formatMoney(n, settings.currency || "R");
  const rows = await getPortalPayments(session.clientId);

  return (
    <div>
      <PageHeader eyebrow="Client portal" title="Payments" />
      {rows.length === 0 ? (
        <EmptyState title="No payments" hint="Payments received against your invoices will appear here." />
      ) : (
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-rule bg-paper-dim/60">
              <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-rule last:border-0">
                  <td className="px-4 py-3 text-ink-soft">{formatDate(p.date)}</td>
                  <td className="px-4 py-3 font-medium text-ink">{p.invoiceNumber}</td>
                  <td className="px-4 py-3 text-ink-soft">{p.method ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-navy">{fmt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}