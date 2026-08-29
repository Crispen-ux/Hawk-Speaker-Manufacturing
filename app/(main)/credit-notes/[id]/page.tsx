import Link from "next/link";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { creditNotes } from "@/db/schema";
import { setCreditNoteStatus, deleteCreditNote } from "@/lib/actions/creditNotes";
import { calcTotals } from "@/lib/money";
import { formatDate, formatMoney, toNumber } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { PageHeader, GhostLink, Card } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import AuditTimeline from "@/components/AuditTimeline";
import { getAuditForDocument } from "@/lib/audit";

export const dynamic = "force-dynamic";

export default async function CreditNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const creditNoteId = Number(id);
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const cn = await db.query.creditNotes.findFirst({
    where: eq(creditNotes.id, creditNoteId),
    with: { client: true, items: true, invoice: true },
  });
  if (!cn) notFound();

  const totals = calcTotals(cn.items, cn.taxRate, cn.discount);
  const history = await getAuditForDocument("creditNote", creditNoteId);
  const setStatus = setCreditNoteStatus.bind(null, creditNoteId);
  const removeCreditNote = deleteCreditNote.bind(null, creditNoteId);

  return (
    <div>
      <PageHeader
        eyebrow={`Credit note · ${cn.client?.name}`}
        title={cn.number}
        action={
          <div className="flex items-center gap-2">
            <StatusStamp status={cn.status} />
            <a
              href={`/api/credit-notes/pdf/${cn.id}`}
              className="rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
              target="_blank"
            >
              Download PDF
            </a>
            <GhostLink href={`/credit-notes/${cn.id}/edit`}>Edit</GhostLink>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <Card>
            <div className="mb-4 flex justify-between text-sm text-ink-soft">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Issued</div>
                <div className="text-ink">{formatDate(cn.issueDate)}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Applies to</div>
                {cn.invoice ? (
                  <Link href={`/invoices/${cn.invoice.id}`} className="font-mono text-ink hover:text-forest">
                    {cn.invoice.number}
                  </Link>
                ) : (
                  <div className="text-ink">—</div>
                )}
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
                {cn.items.map((it) => (
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
                  <span>Total credit</span>
                  <span className="font-mono">{money(totals.total)}</span>
                </div>
              </div>
            </div>

            {cn.paymentTerms && (
              <div className="mt-6 border-t border-rule pt-4 text-sm text-ink-soft">{cn.paymentTerms}</div>
            )}
            {cn.notes && (
              <div className="mt-4 border-t border-rule pt-4 text-sm text-ink-soft">{cn.notes}</div>
            )}
          </Card>

          <div className="mt-6">
            <AuditTimeline entries={history} />
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Status</h3>
            <div className="flex flex-wrap gap-2">
              {(["draft", "issued", "applied", "cancelled"] as const).map((s) => (
                <form key={s} action={setStatus.bind(null, s)}>
                  <button className="rounded-full border border-rule-strong px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-ink-soft hover:border-forest hover:text-forest">
                    mark {s}
                  </button>
                </form>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Issued to</h3>
            <p className="font-medium text-ink">{cn.client?.name}</p>
            {cn.client?.email && <p className="text-sm text-ink-soft">{cn.client.email}</p>}
            {cn.client?.address && (
              <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{cn.client.address}</p>
            )}
          </Card>

          <form action={removeCreditNote}>
            <button className="w-full font-mono text-xs uppercase tracking-wide text-rust hover:underline">
              Delete credit note
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}