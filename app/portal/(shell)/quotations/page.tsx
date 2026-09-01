import Link from "next/link";
import { requireActivePortalUser } from "@/lib/auth-portal";
import { getPortalQuotations } from "@/lib/portal-data";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/money";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-paper-dim text-ink-soft",
  sent: "bg-sky-50 text-sky-700",
  accepted: "bg-emerald-50 text-emerald-700",
  declined: "bg-red-50 text-red-700",
  expired: "bg-amber-50 text-amber-700",
};

export default async function PortalQuotationsPage() {
  const session = await requireActivePortalUser();
  const settings = await getSettings();
  const fmt = (n: string | number) => formatMoney(n, settings.currency || "R");
  const quotes = await getPortalQuotations(session.clientId);

  return (
    <div>
      <PageHeader eyebrow="Client portal" title="Quotations" />
      {quotes.length === 0 ? (
        <EmptyState title="No quotations" hint="Quotations sent to you will appear here." />
      ) : (
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-rule bg-paper-dim/60">
              <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
                <th className="px-4 py-3">Quotation</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Valid until</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-b border-rule last:border-0 hover:bg-paper-dim/40">
                  <td className="px-4 py-3">
                    <Link href={`/portal/quotations/${q.id}`} className="font-medium text-forest hover:underline">
                      {q.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(q.issueDate)}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(q.expiryDate)}</td>
                  <td className="px-4 py-3 font-medium text-navy">{fmt(q.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[q.status] ?? "bg-paper-dim text-ink-soft"}`}>
                      {q.status}
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