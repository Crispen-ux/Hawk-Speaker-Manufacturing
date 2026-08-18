import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { invoices } from "@/db/schema";
import { setInvoiceStatus, deleteInvoice, addPayment, deletePayment } from "@/lib/actions/invoices";
import { computeInvoice } from "@/lib/calc";
import { formatDate, formatMoney, toNumber } from "@/lib/money";
import { PageHeader, GhostLink, Card, Field, inputClass, PrimaryButton } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = Number(id);

  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, invoiceId),
    with: { client: true, items: true, payments: true },
  });
  if (!invoice) notFound();

  const totals = computeInvoice(invoice, invoice.items, invoice.payments);
  const setStatus = setInvoiceStatus.bind(null, invoiceId);
  const removeInvoice = deleteInvoice.bind(null, invoiceId);
  const recordPayment = addPayment.bind(null, invoiceId);

  return (
    <div>
      <PageHeader
        eyebrow={`Invoice · ${invoice.client?.name}`}
        title={invoice.number}
        action={
          <div className="flex items-center gap-2">
            <StatusStamp status={totals.effectiveStatus} />
            <a
              href={`/api/invoices/pdf/${invoice.id}`}
              className="rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
              target="_blank"
            >
              Download PDF
            </a>
            <GhostLink href={`/invoices/${invoice.id}/edit`}>Edit</GhostLink>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <Card>
            <div className="mb-4 flex justify-between text-sm text-ink-soft">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Issued</div>
                <div className="text-ink">{formatDate(invoice.issueDate)}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Due</div>
                <div className="text-ink">{formatDate(invoice.dueDate)}</div>
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
                {invoice.items.map((it) => (
                  <tr key={it.id} className="border-b border-rule last:border-b-0">
                    <td className="py-2.5">{it.description}</td>
                    <td className="py-2.5 text-right font-mono">{it.quantity}</td>
                    <td className="py-2.5 text-right font-mono">{formatMoney(it.unitPrice)}</td>
                    <td className="py-2.5 text-right font-mono">
                      {formatMoney(toNumber(it.quantity) * toNumber(it.unitPrice))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Subtotal</span>
                  <span className="font-mono">{formatMoney(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Discount</span>
                    <span className="font-mono">-{formatMoney(totals.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-ink-soft">Tax</span>
                  <span className="font-mono">{formatMoney(totals.tax)}</span>
                </div>
                <div className="flex justify-between border-t border-rule pt-1.5 text-base font-semibold">
                  <span>Total</span>
                  <span className="font-mono">{formatMoney(totals.total)}</span>
                </div>
                {totals.paid > 0 && (
                  <>
                    <div className="flex justify-between text-forest">
                      <span>Paid</span>
                      <span className="font-mono">{formatMoney(totals.paid)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Balance</span>
                      <span className="font-mono">{formatMoney(totals.balance)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {invoice.notes && (
              <div className="mt-6 border-t border-rule pt-4 text-sm text-ink-soft">{invoice.notes}</div>
            )}
          </Card>

          <div className="mt-6">
            <h2 className="mb-3 font-display text-lg italic text-ink">Payments</h2>
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-ink-soft">No payments recorded yet.</p>
            ) : (
              <div className="mb-4 overflow-hidden rounded-lg border border-rule">
                <table className="w-full text-sm">
                  <tbody>
                    {invoice.payments.map((p) => {
                      const removePayment = deletePayment.bind(null, p.id, invoiceId);
                      return (
                        <tr key={p.id} className="border-b border-rule last:border-b-0">
                          <td className="px-4 py-2 text-ink-soft">{formatDate(p.date)}</td>
                          <td className="px-4 py-2 font-mono">{formatMoney(p.amount)}</td>
                          <td className="px-4 py-2 text-ink-soft">{p.method || "—"}</td>
                          <td className="px-4 py-2 text-right">
                            <form action={removePayment}>
                              <button className="font-mono text-xs text-rust hover:underline">remove</button>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <Card>
              <form action={recordPayment} className="grid grid-cols-4 gap-3 items-end">
                <Field label="Amount">
                  <input name="amount" required inputMode="decimal" className={inputClass} placeholder="0.00" />
                </Field>
                <Field label="Date">
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Method">
                  <input name="method" className={inputClass} placeholder="EFT" />
                </Field>
                <PrimaryButton type="submit">Record payment</PrimaryButton>
              </form>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Status</h3>
            <div className="flex flex-wrap gap-2">
              {(["draft", "sent", "paid", "cancelled"] as const).map((s) => (
                <form key={s} action={setStatus.bind(null, s)}>
                  <button className="rounded-full border border-rule-strong px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-ink-soft hover:border-forest hover:text-forest">
                    mark {s}
                  </button>
                </form>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Bill to</h3>
            <p className="font-medium text-ink">{invoice.client?.name}</p>
            {invoice.client?.email && <p className="text-sm text-ink-soft">{invoice.client.email}</p>}
            {invoice.client?.address && (
              <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{invoice.client.address}</p>
            )}
          </Card>

          <form action={removeInvoice}>
            <button className="w-full font-mono text-xs uppercase tracking-wide text-rust hover:underline">
              Delete invoice
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
