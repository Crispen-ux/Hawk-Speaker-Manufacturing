import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import { formatDate, formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");
  const rows = await db.query.receipts.findMany({
    with: { client: true, invoice: true },
    orderBy: (receipts, { desc }) => [desc(receipts.createdAt)],
  });

  return (
    <div>
      <PageHeader eyebrow="Accounts receivable" title="Receipts" />

      {rows.length === 0 ? (
        <EmptyState
          title="No receipts yet"
          hint="Receipts are minted automatically whenever you record a payment against an invoice."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Against</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Method</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="px-4 py-3">
                    <Link href={`/receipts/${r.id}`} className="font-mono font-medium text-ink hover:text-forest">
                      {r.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.client?.name}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {r.invoice ? (
                      <Link href={`/invoices/${r.invoice.id}`} className="font-mono hover:text-forest">
                        {r.invoice.number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(r.issueDate)}</td>
                  <td className="px-4 py-3 text-ink-soft">{r.method || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{money(r.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <StatusStamp status="paid" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}