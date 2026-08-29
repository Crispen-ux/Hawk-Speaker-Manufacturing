import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { quotations } from "@/db/schema";
import { setQuotationStatus, deleteQuotation, convertToInvoice } from "@/lib/actions/quotations";
import { sendQuotationEmailAction } from "@/lib/actions/send";
import { computeQuotation } from "@/lib/calc";
import { formatDate, formatMoney, toNumber } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { publicDocumentUrl } from "@/lib/public-links";
import { buildDocumentWaMessage } from "@/lib/whatsapp-deeplink";
import { PageHeader, GhostLink, Card } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import SendEmailForm from "@/components/SendEmailForm";
import WhatsAppOpenForm from "@/components/WhatsAppOpenForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quotationId = Number(id);
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const quotation = await db.query.quotations.findFirst({
    where: eq(quotations.id, quotationId),
    with: { client: true, items: true },
  });
  if (!quotation) notFound();

  const totals = computeQuotation(quotation, quotation.items);
  const setStatus = setQuotationStatus.bind(null, quotationId);
  const removeQuotation = deleteQuotation.bind(null, quotationId);
  const convert = convertToInvoice.bind(null, quotationId);
  const sendAction = sendQuotationEmailAction.bind(null, quotationId);
  const waLink = await publicDocumentUrl({ kind: "quotation", documentId: quotationId });
  const waMessage = buildDocumentWaMessage(
    {
      number: quotation.number,
      status: quotation.status,
      clientName: quotation.client?.name,
      items: quotation.items,
      taxRate: quotation.taxRate,
      discount: quotation.discount,
      notes: quotation.notes,
      dueLabel: "Valid until",
      dueValue: formatDate(quotation.expiryDate),
    },
    {
      companyName: settings.companyName,
      currency: settings.currency || "R",
      kindLabel: "QUOTATION",
      link: waLink,
    }
  );

  return (
    <div>
      <PageHeader
        eyebrow={`Quotation · ${quotation.client?.name}`}
        title={quotation.number}
        action={
          <div className="flex items-center gap-2">
            <StatusStamp status={quotation.status} />
            <a
              href={`/api/quotations/pdf/${quotation.id}`}
              className="rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
              target="_blank"
            >
              Download PDF
            </a>
            <GhostLink href={`/quotations/${quotation.id}/edit`}>Edit</GhostLink>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <Card>
            <div className="mb-4 flex justify-between text-sm text-ink-soft">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Issued</div>
                <div className="text-ink">{formatDate(quotation.issueDate)}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Valid until</div>
                <div className="text-ink">{formatDate(quotation.expiryDate)}</div>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                  <th className="py-2 font-medium">Description</th>
                  <th className="py-2 text-right font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Unit</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((it) => (
                  <tr key={it.id} className="border-b border-rule last:border-b-0">
                    <td className="py-2.5">{it.description}</td>
                    <td className="py-2.5 text-right font-mono">{it.quantity}</td>
                    <td className="py-2.5 text-right font-mono">{money(it.unitPrice)}</td>
                    <td className="py-2.5 text-right font-mono">
                      {money(toNumber(it.quantity) * toNumber(it.unitPrice))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Subtotal</span>
                  <span className="font-mono">{money(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Discount</span>
                    <span className="font-mono">-{money(totals.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-ink-soft">Tax</span>
                  <span className="font-mono">{money(totals.tax)}</span>
                </div>
                <div className="flex justify-between border-t border-rule pt-1.5 text-base font-semibold">
                  <span>Total</span>
                  <span className="font-mono">{money(totals.total)}</span>
                </div>
              </div>
            </div>

            {quotation.notes && (
              <div className="mt-6 border-t border-rule pt-4 text-sm text-ink-soft">{quotation.notes}</div>
            )}
          </Card>

          {quotation.convertedInvoiceId && (
            <p className="mt-4 text-sm text-ink-soft">
              Converted to invoice{" "}
              <Link href={`/invoices/${quotation.convertedInvoiceId}`} className="text-forest hover:underline">
                view invoice →
              </Link>
            </p>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">
              Send by email
            </h3>
            <SendEmailForm action={sendAction} defaultTo={quotation.client?.email} buttonLabel="Send quotation" />
            {quotation.lastSentAt && (
              <p className="mt-3 border-t border-rule pt-3 text-xs text-ink-soft">
                Last sent {formatDate(quotation.lastSentAt.toISOString())}
              </p>
            )}
          </Card>

          <Card>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">
              Send by WhatsApp
            </h3>
            <WhatsAppOpenForm
              defaultPhone={quotation.client?.phone ?? settings.phone}
              message={waMessage}
              buttonLabel="Open in WhatsApp"
            />
          </Card>

          <Card>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Status</h3>
            <div className="flex flex-wrap gap-2">
              {(["draft", "sent", "accepted", "declined", "expired"] as const).map((s) => (
                <form key={s} action={setStatus.bind(null, s)}>
                  <button className="rounded-full border border-rule-strong px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-ink-soft hover:border-forest hover:text-forest">
                    mark {s}
                  </button>
                </form>
              ))}
            </div>
          </Card>

          {!quotation.convertedInvoiceId && (
            <Card>
              <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Ready to bill?</h3>
              <p className="mb-3 text-sm text-ink-soft">
                Turn this quotation straight into an invoice with the same line items.
              </p>
              <form action={convert}>
                <button className="w-full rounded-md bg-forest px-4 py-2 text-sm font-medium text-paper hover:opacity-90">
                  Convert to invoice
                </button>
              </form>
            </Card>
          )}

          <Card>
            <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Prepared for</h3>
            <p className="font-medium text-ink">{quotation.client?.name}</p>
            {quotation.client?.email && <p className="text-sm text-ink-soft">{quotation.client.email}</p>}
          </Card>

          <form action={removeQuotation}>
            <button className="w-full font-mono text-xs uppercase tracking-wide text-rust hover:underline">
              Delete quotation
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
