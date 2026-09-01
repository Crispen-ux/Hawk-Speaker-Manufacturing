import { notFound } from "next/navigation";
import { requireActivePortalUser } from "@/lib/auth-portal";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader, Card } from "@/components/ui";
import { formatMoney, formatDate, calcTotals, toNumber } from "@/lib/money";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export default async function PortalInvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireActivePortalUser();
  const { id } = await params;
  const invoiceId = Number(id);

  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, invoiceId),
    with: { client: true, items: true, payments: true },
  });
  if (!invoice || invoice.clientId !== session.clientId) notFound();

  const settings = await getSettings();
  const fmt = (n: string | number) => formatMoney(n, settings.currency || "R");
  const totals = calcTotals(invoice.items, invoice.taxRate, invoice.discount);
  const paid = invoice.payments.reduce((s, p) => s + toNumber(p.amount), 0);
  const balance = Math.max(totals.total - paid, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Invoice"
        title={invoice.number}
        action={
          <a
            href={`/api/portal/pdf/invoice/${invoice.id}`}
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
              <Meta label="Issued" value={formatDate(invoice.issueDate)} />
              <Meta label="Due" value={formatDate(invoice.dueDate)} />
              <Meta label="Status" value={invoice.status} />
              <Meta label="Source" value={invoice.sourceQuotationId ? "Quotation" : "Direct"} />
            </div>
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
                {invoice.items.map((it, i) => (
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
                    <td colSpan={3} className="py-1.5 text-right">Discount</td>
                    <td className="py-1.5 text-right">−{fmt(totals.discount)}</td>
                  </tr>
                )}
                {totals.tax > 0 && (
                  <tr className="text-xs text-ink-soft">
                    <td colSpan={3} className="py-1.5 text-right">Tax ({invoice.taxRate}%)</td>
                    <td className="py-1.5 text-right">{fmt(totals.tax)}</td>
                  </tr>
                )}
                <tr className="border-t border-rule">
                  <td colSpan={3} className="py-2 text-sm font-semibold text-navy">Total</td>
                  <td className="py-2 text-right font-display text-lg font-extrabold text-navy">{fmt(totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </div>

        <Card>
          <h3 className="mb-3 font-display text-base font-bold text-navy">Payment summary</h3>
          <div className="space-y-2 text-sm">
            <Row label="Invoice total" value={fmt(totals.total)} />
            <Row label="Paid" value={fmt(paid)} />
            <div className="border-t border-rule pt-2">
              <Row label={balance > 0 ? "Balance due" : "Settled"} value={fmt(balance)} bold={balance > 0} />
            </div>
            {invoice.paymentTerms && <p className="pt-2 text-xs text-ink-soft">{invoice.paymentTerms}</p>}
          </div>
          {invoice.payments.length > 0 && (
            <div className="mt-4 border-t border-rule pt-4">
              <h4 className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Payments received</h4>
              <div className="space-y-2">
                {invoice.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-ink-soft">{formatDate(p.date)}{p.method ? ` · ${p.method}` : ""}</span>
                    <span className="font-medium text-emerald-700">{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
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

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className={bold ? "text-lg font-extrabold text-navy" : "font-medium text-ink"}>{value}</span>
    </div>
  );
}