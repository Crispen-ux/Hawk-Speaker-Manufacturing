import { requireActivePortalUser } from "@/lib/auth-portal";
import { getPortalReceipts } from "@/lib/portal-data";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/money";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export default async function PortalReceiptsPage() {
  const session = await requireActivePortalUser();
  const settings = await getSettings();
  const fmt = (n: string | number) => formatMoney(n, settings.currency || "R");
  const rows = await getPortalReceipts(session.clientId);

  return (
    <div>
      <PageHeader eyebrow="Client portal" title="Receipts" />
      {rows.length === 0 ? (
        <EmptyState title="No receipts" hint="Receipts for your payments will appear here." />
      ) : (
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-rule bg-paper-dim/60">
              <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
                <th className="px-4 py-3">Receipt</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-rule last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{r.number}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(r.issueDate)}</td>
                  <td className="px-4 py-3 text-right font-medium text-navy">{fmt(r.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/api/portal/pdf/receipt/${r.id}`} className="text-sm font-medium text-forest hover:underline">
                      PDF
                    </a>
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