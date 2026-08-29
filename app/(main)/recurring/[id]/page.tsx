import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { recurringInvoices } from "@/db/schema";
import Link from "next/link";
import { deleteRecurring, generateNow, toggleRecurringActive } from "@/lib/actions/recurring";
import { calcTotals, formatDate, formatMoney, toNumber } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { PageHeader, GhostLink, Card } from "@/components/ui";
import ConfirmForm from "@/components/ConfirmForm";

export const dynamic = "force-dynamic";

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export default async function RecurringDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recurringId = Number(id);
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const rec = await db.query.recurringInvoices.findFirst({
    where: eq(recurringInvoices.id, recurringId),
    with: { client: true, items: true },
  });
  if (!rec) notFound();

  const totals = calcTotals(rec.items, rec.taxRate, rec.discount);
  const generate = generateNow.bind(null, recurringId);
  const remove = deleteRecurring.bind(null, recurringId);
  const toggle = toggleRecurringActive.bind(null, recurringId, !rec.active);

  return (
    <div>
      <PageHeader
        eyebrow={`Recurring · ${rec.client?.name}`}
        title={`${FREQUENCY_LABEL[rec.frequency]} invoice`}
        action={
          <div className="flex items-center gap-2">
            <form action={toggle}>
              <button
                className={`rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide ${
                  rec.active ? "border-forest text-forest" : "border-rule-strong text-ink-soft"
                }`}
              >
                {rec.active ? "active" : "paused"}
              </button>
            </form>
            <GhostLink href={`/recurring/${rec.id}/edit`}>Edit</GhostLink>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <Card>
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
                {rec.items.map((it) => (
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
                <div className="flex justify-between border-t border-rule pt-1.5 text-base font-semibold">
                  <span>Total per cycle</span>
                  <span className="font-mono">{money(totals.total)}</span>
                </div>
              </div>
            </div>

            {rec.notes && <div className="mt-6 border-t border-rule pt-4 text-sm text-ink-soft">{rec.notes}</div>}
          </Card>

          {rec.lastInvoiceId && (
            <p className="mt-4 text-sm text-ink-soft">
              Last generated invoice:{" "}
              <Link href={`/invoices/${rec.lastInvoiceId}`} className="text-forest hover:underline">
                view →
              </Link>
              {rec.lastGeneratedAt && ` on ${formatDate(rec.lastGeneratedAt.toISOString())}`}
            </p>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Schedule</h3>
            <p className="text-sm text-ink">
              {FREQUENCY_LABEL[rec.frequency]}, due {rec.dueInDays} days after issue
            </p>
            <p className="mt-1 text-sm text-ink-soft">Next invoice: {formatDate(rec.nextRunDate)}</p>
            {rec.autoSend && <p className="mt-1 text-sm text-forest">Auto-sends by email to {rec.client?.email || "—"}</p>}
          </Card>

          <Card>
            <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Generate now</h3>
            <p className="mb-3 text-sm text-ink-soft">
              Create an invoice from this profile right away, outside the normal schedule.
            </p>
            <form action={generate}>
              <button className="w-full rounded-md bg-forest px-4 py-2 text-sm font-medium text-paper hover:opacity-90">
                Generate invoice now
              </button>
            </form>
          </Card>

          <ConfirmForm action={remove} confirm="Delete this recurring invoice? No more invoices will be generated from it.">
            <button className="w-full font-mono text-xs uppercase tracking-wide text-rust hover:underline">
              Delete recurring invoice
            </button>
          </ConfirmForm>
        </div>
      </div>
    </div>
  );
}
