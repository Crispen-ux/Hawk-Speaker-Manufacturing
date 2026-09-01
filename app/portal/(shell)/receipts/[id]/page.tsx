import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActivePortalUser } from "@/lib/auth-portal";
import { db } from "@/db";
import { receipts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader, Card } from "@/components/ui";
import { formatMoney, formatDate, toNumber } from "@/lib/money";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export default async function PortalReceiptDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireActivePortalUser();
  const { id } = await params;
  const receipt = await db.query.receipts.findFirst({
    where: eq(receipts.id, Number(id)),
    with: { invoice: true },
  });
  if (!receipt || receipt.clientId !== session.clientId) notFound();

  const settings = await getSettings();
  const fmt = (n: string | number) => formatMoney(n, settings.currency || "R");

  return (
    <div>
      <PageHeader
        eyebrow="Receipt"
        title={receipt.number}
        action={
          <a
            href={`/api/portal/pdf/receipt/${receipt.id}`}
            className="inline-block rounded-md bg-navy px-4 py-2 text-sm font-semibold text-paper hover:bg-navy-2"
          >
            Download PDF
          </a>
        }
      />

      <Card className="max-w-xl">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-rule pb-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Receipt date</dt>
            <dd className="font-medium text-ink">{formatDate(receipt.issueDate)}</dd>
          </div>
          <div className="flex justify-between border-b border-rule pb-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Invoice</dt>
            <dd className="font-medium text-ink">
              {receipt.invoice ? (
                <Link href={`/portal/invoices/${receipt.invoiceId}`} className="text-forest hover:underline">
                  {receipt.invoice.number}
                </Link>
              ) : (
                `#${receipt.invoiceId}`
              )}
            </dd>
          </div>
          <div className="flex justify-between border-b border-rule pb-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Payment method</dt>
            <dd className="font-medium text-ink">{receipt.method ?? "—"}</dd>
          </div>
          <div className="flex justify-between border-b border-rule pb-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Amount received</dt>
            <dd className="font-display text-lg font-extrabold text-emerald-700">{fmt(toNumber(receipt.amount))}</dd>
          </div>
          {receipt.note && (
            <div className="flex justify-between gap-6 border-b border-rule pb-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Note</dt>
              <dd className="text-right font-medium text-ink">{receipt.note}</dd>
            </div>
          )}
        </dl>
      </Card>
    </div>
  );
}