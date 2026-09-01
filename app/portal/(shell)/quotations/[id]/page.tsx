import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActivePortalUser } from "@/lib/auth-portal";
import { db } from "@/db";
import { quotations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader, Card } from "@/components/ui";
import { formatMoney, formatDate, calcTotals } from "@/lib/money";
import { getSettings } from "@/lib/numbering";

import PortalQuotationActions from "./PortalQuotationActions";

export const dynamic = "force-dynamic";

export default async function PortalQuotationDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireActivePortalUser();
  const { id } = await params;
  const quotationId = Number(id);

  const quote = await db.query.quotations.findFirst({
    where: eq(quotations.id, quotationId),
    with: { client: true, items: true },
  });
  if (!quote || quote.clientId !== session.clientId) notFound();

  const settings = await getSettings();
  const fmt = (n: string | number) => formatMoney(n, settings.currency || "R");
  const totals = calcTotals(quote.items, quote.taxRate, quote.discount);

  const readable = quote.status === "accepted" || quote.status === "declined" || quote.status === "expired";

  return (
    <div>
      <PageHeader
        eyebrow="Quotation"
        title={quote.number}
        action={
          <a
            href={`/api/portal/pdf/quotation/${quote.id}`}
            className="inline-block rounded-md bg-navy px-4 py-2 text-sm font-semibold text-paper hover:bg-navy-2"
          >
            Download PDF
          </a>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="mb-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Meta label="Issued" value={formatDate(quote.issueDate)} />
              <Meta label="Valid until" value={formatDate(quote.expiryDate)} />
              <Meta label="Status" value={quote.status} />
              <Meta label="Tax rate" value={`${quote.taxRate}%`} />
            </div>
            {quote.notes && <p className="mb-4 whitespace-pre-wrap text-sm text-ink-soft">{quote.notes}</p>}
            <table className="w-full text-left text-sm">
              <thead className="border-b border-rule font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
                <tr>
                  <th className="py-2">Description</th>
                  <th className="py-2">Qty</th>
                  <th className="py-2">Unit price</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((it, i) => (
                  <tr key={i} className="border-b border-rule last:border-0">
                    <td className="py-2">{it.description}</td>
                    <td className="py-2">{it.quantity}</td>
                    <td className="py-2">{fmt(it.unitPrice)}</td>
                    <td className="py-2 text-right">{fmt(Number(it.quantity) * Number(it.unitPrice))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {totals.discount > 0 && (
                  <tr className="border-t border-rule text-xs text-ink-soft">
                    <td colSpan={3} className="py-1.5 text-right">
                      Discount
                    </td>
                    <td className="py-1.5 text-right">−{fmt(totals.discount)}</td>
                  </tr>
                )}
                {totals.tax > 0 && (
                  <tr className="text-xs text-ink-soft">
                    <td colSpan={3} className="py-1.5 text-right">
                      Tax ({quote.taxRate}%)
                    </td>
                    <td className="py-1.5 text-right">{fmt(totals.tax)}</td>
                  </tr>
                )}
                <tr className="border-t border-rule">
                  <td colSpan={3} className="py-2 text-sm font-semibold text-navy">
                    Total
                  </td>
                  <td className="py-2 text-right font-display text-lg font-extrabold text-navy">{fmt(totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </div>

        <div className="space-y-6">
          {quote.status === "sent" && (
            <PortalQuotationActions quotationId={quote.id} status={quote.status} />
          )}
          {readable && (
            <Card>
              <h3 className="mb-2 font-display text-base font-bold text-navy">Decision</h3>
              <p className="text-sm text-ink-soft">
                {quote.status === "accepted" && `Approved${quote.approvedAt ? ` on ${formatDate(quote.approvedAt)}` : ""}.`}
                {quote.status === "declined" && (
                  <>Declined{quote.declineReason ? ` — ${quote.declineReason}` : ""}. This quotation has been closed.</>
                )}
                {quote.status === "expired" && "This quotation has expired and can no longer be approved."}
              </p>
              {quote.convertedInvoiceId && (
                <p className="mt-2 text-sm text-ink">
                  Converted to invoice.{" "}
                  <Link href={`/portal/invoices/${quote.convertedInvoiceId}`} className="font-medium text-forest hover:underline">
                    View invoice →
                  </Link>
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">{label}</div>
      <div className="mt-0.5 text-sm font-medium capitalize text-ink">{value}</div>
    </div>
  );
}