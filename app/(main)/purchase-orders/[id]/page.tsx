import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { purchaseOrders } from "@/db/schema";
import { setPurchaseOrderStatus, deletePurchaseOrder } from "@/lib/actions/purchaseOrders";
import { sendPurchaseOrderEmailAction } from "@/lib/actions/send";
import { calcTotals, formatDate, formatMoney, toNumber } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { PageHeader, GhostLink, Card } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import SendEmailForm from "@/components/SendEmailForm";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const poId = Number(id);
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const po = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, poId),
    with: { supplier: true, items: true },
  });
  if (!po) notFound();

  const totals = calcTotals(po.items, po.taxRate, po.discount);
  const setStatus = setPurchaseOrderStatus.bind(null, poId);
  const removePO = deletePurchaseOrder.bind(null, poId);
  const sendAction = sendPurchaseOrderEmailAction.bind(null, poId);

  return (
    <div>
      <PageHeader
        eyebrow={`Purchase order · ${po.supplier?.name}`}
        title={po.number}
        action={
          <div className="flex items-center gap-2">
            <StatusStamp status={po.status} />
            <a
              href={`/api/purchase-orders/pdf/${po.id}`}
              className="rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
              target="_blank"
            >
              Download PDF
            </a>
            <GhostLink href={`/purchase-orders/${po.id}/edit`}>Edit</GhostLink>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <Card>
            <div className="mb-4 flex justify-between text-sm text-ink-soft">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Issued</div>
                <div className="text-ink">{formatDate(po.issueDate)}</div>
              </div>
              {po.expectedDate && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Expected delivery</div>
                  <div className="text-ink">{formatDate(po.expectedDate)}</div>
                </div>
              )}
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
                {po.items.map((it) => (
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

            {po.notes && <div className="mt-6 border-t border-rule pt-4 text-sm text-ink-soft">{po.notes}</div>}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">
              Send by email
            </h3>
            <SendEmailForm action={sendAction} defaultTo={po.supplier?.email} buttonLabel="Send purchase order" />
            {po.lastSentAt && (
              <p className="mt-3 border-t border-rule pt-3 text-xs text-ink-soft">
                Last sent {formatDate(po.lastSentAt.toISOString())}
              </p>
            )}
          </Card>

          <Card>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Status</h3>
            <div className="flex flex-wrap gap-2">
              {(["draft", "sent", "confirmed", "received", "cancelled"] as const).map((s) => (
                <form key={s} action={setStatus.bind(null, s)}>
                  <button className="rounded-full border border-rule-strong px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-ink-soft hover:border-forest hover:text-forest">
                    mark {s}
                  </button>
                </form>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Supplier</h3>
            <p className="font-medium text-ink">{po.supplier?.name}</p>
            {po.supplier?.email && <p className="text-sm text-ink-soft">{po.supplier.email}</p>}
            {po.supplier?.address && (
              <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{po.supplier.address}</p>
            )}
          </Card>

          <form action={removePO}>
            <button className="w-full font-mono text-xs uppercase tracking-wide text-rust hover:underline">
              Delete purchase order
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
