import Link from "next/link";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { receipts } from "@/db/schema";
import { formatDate, formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { PageHeader, Card } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import AuditTimeline from "@/components/AuditTimeline";
import { getAuditForDocument } from "@/lib/audit";

export const dynamic = "force-dynamic";

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const receiptId = Number(id);
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const receipt = await db.query.receipts.findFirst({
    where: eq(receipts.id, receiptId),
    with: { client: true, invoice: true },
  });
  if (!receipt) notFound();

  const history = await getAuditForDocument("receipt", receiptId);

  return (
    <div>
      <PageHeader
        eyebrow={`Receipt · ${receipt.client?.name}`}
        title={receipt.number}
        action={
          <div className="flex items-center gap-2">
            <StatusStamp status="paid" />
            <a
              href={`/api/receipts/pdf/${receipt.id}`}
              className="rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
              target="_blank"
            >
              Download PDF
            </a>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <Card>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Amount</div>
                <div className="font-mono text-lg font-semibold text-forest">{money(receipt.amount)}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Date</div>
                <div className="text-ink">{formatDate(receipt.issueDate)}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Method</div>
                <div className="text-ink">{receipt.method || "—"}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Against invoice</div>
                {receipt.invoice ? (
                  <Link
                    href={`/invoices/${receipt.invoice.id}`}
                    className="font-mono text-ink hover:text-forest"
                  >
                    {receipt.invoice.number}
                  </Link>
                ) : (
                  <div className="text-ink">—</div>
                )}
              </div>
            </div>

            {receipt.note && (
              <div className="mt-6 border-t border-rule pt-4 text-sm text-ink-soft">{receipt.note}</div>
            )}
          </Card>

          <div className="mt-6">
            <AuditTimeline entries={history} />
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Received from</h3>
            <p className="font-medium text-ink">{receipt.client?.name}</p>
            {receipt.client?.email && <p className="text-sm text-ink-soft">{receipt.client.email}</p>}
            {receipt.client?.address && (
              <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{receipt.client.address}</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}