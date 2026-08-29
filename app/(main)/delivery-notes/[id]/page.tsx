import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deliveryNotes, invoices } from "@/db/schema";
import Link from "next/link";
import { setDeliveryNoteStatus, deleteDeliveryNote } from "@/lib/actions/deliveryNotes";
import { sendDeliveryNoteEmailAction } from "@/lib/actions/send";
import { formatDate } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { publicDocumentUrl } from "@/lib/public-links";
import { buildDocumentWaMessage } from "@/lib/whatsapp-deeplink";
import { PageHeader, GhostLink, Card } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import SendEmailForm from "@/components/SendEmailForm";
import WhatsAppOpenForm from "@/components/WhatsAppOpenForm";
import ConfirmForm from "@/components/ConfirmForm";

export const dynamic = "force-dynamic";

export default async function DeliveryNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dnId = Number(id);
  const settings = await getSettings();

  const dn = await db.query.deliveryNotes.findFirst({
    where: eq(deliveryNotes.id, dnId),
    with: { client: true, items: true },
  });
  if (!dn) notFound();

  let relatedInvoice = null;
  if (dn.relatedInvoiceId) {
    [relatedInvoice] = await db.select().from(invoices).where(eq(invoices.id, dn.relatedInvoiceId));
  }

  const setStatus = setDeliveryNoteStatus.bind(null, dnId);
  const removeDN = deleteDeliveryNote.bind(null, dnId);
  const sendAction = sendDeliveryNoteEmailAction.bind(null, dnId);
  const waLink = await publicDocumentUrl({ kind: "deliveryNote", documentId: dnId });
  const waMessage = buildDocumentWaMessage(
    {
      number: dn.number,
      status: dn.status,
      clientName: dn.client?.name,
      items: dn.items.map((it) => ({ description: it.description, quantity: it.quantity, unitPrice: "0" })),
      taxRate: "0",
      discount: "0",
      notes: dn.notes,
    },
    {
      companyName: settings.companyName,
      currency: settings.currency || "R",
      kindLabel: "DELIVERY NOTE",
      link: waLink,
      showPricing: false,
    }
  );

  return (
    <div>
      <PageHeader
        eyebrow={`Delivery note · ${dn.client?.name}`}
        title={dn.number}
        action={
          <div className="flex items-center gap-2">
            <StatusStamp status={dn.status} />
            <a
              href={`/api/delivery-notes/pdf/${dn.id}`}
              className="rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
              target="_blank"
            >
              Download PDF
            </a>
            <GhostLink href={`/delivery-notes/${dn.id}/edit`}>Edit</GhostLink>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <Card>
            <div className="mb-4 text-sm text-ink-soft">
              <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Delivery date</div>
              <div className="text-ink">{formatDate(dn.deliveryDate)}</div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                  <th className="py-2 font-medium">Description</th>
                  <th className="py-2 text-right font-medium">Qty delivered</th>
                </tr>
              </thead>
              <tbody>
                {dn.items.map((it) => (
                  <tr key={it.id} className="border-b border-rule last:border-b-0">
                    <td className="py-2.5">{it.description}</td>
                    <td className="py-2.5 text-right font-mono">{it.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-rule pt-4 text-sm">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Delivered by</div>
                <div className="text-ink">{dn.deliveredBy || "—"}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Received by</div>
                <div className="text-ink">{dn.receivedBy || "—"}</div>
              </div>
            </div>

            {dn.notes && <div className="mt-6 border-t border-rule pt-4 text-sm text-ink-soft">{dn.notes}</div>}
          </Card>

          {relatedInvoice && (
            <p className="mt-4 text-sm text-ink-soft">
              Related invoice:{" "}
              <Link href={`/invoices/${relatedInvoice.id}`} className="text-forest hover:underline">
                {relatedInvoice.number} →
              </Link>
            </p>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">
              Send by email
            </h3>
            <SendEmailForm action={sendAction} defaultTo={dn.client?.email} buttonLabel="Send delivery note" />
            {dn.lastSentAt && (
              <p className="mt-3 border-t border-rule pt-3 text-xs text-ink-soft">
                Last sent {formatDate(dn.lastSentAt.toISOString())}
              </p>
            )}
          </Card>

          <Card>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">
              Send by WhatsApp
            </h3>
            <WhatsAppOpenForm
              defaultPhone={dn.client?.phone ?? settings.phone}
              message={waMessage}
              buttonLabel="Open in WhatsApp"
            />
          </Card>

          <Card>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Status</h3>
            <div className="flex flex-wrap gap-2">
              {(["draft", "delivered"] as const).map((s) => (
                <form key={s} action={setStatus.bind(null, s)}>
                  <button className="rounded-full border border-rule-strong px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-ink-soft hover:border-forest hover:text-forest">
                    mark {s}
                  </button>
                </form>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Client</h3>
            <p className="font-medium text-ink">{dn.client?.name}</p>
            {dn.client?.email && <p className="text-sm text-ink-soft">{dn.client.email}</p>}
          </Card>

          <ConfirmForm action={removeDN} confirm="Delete this delivery note? This can't be undone.">
            <button className="w-full font-mono text-xs uppercase tracking-wide text-rust hover:underline">
              Delete delivery note
            </button>
          </ConfirmForm>
        </div>
      </div>
    </div>
  );
}
