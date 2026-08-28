import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { jobCards } from "@/db/schema";
import Link from "next/link";
import { setJobCardStatus, deleteJobCard, convertJobCardToInvoice } from "@/lib/actions/jobCards";
import { sendJobCardEmailAction } from "@/lib/actions/send";
import { calcTotals, formatDate, formatMoney, toNumber } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { PageHeader, GhostLink, Card } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import SendEmailForm from "@/components/SendEmailForm";

export const dynamic = "force-dynamic";

export default async function JobCardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = Number(id);
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const job = await db.query.jobCards.findFirst({
    where: eq(jobCards.id, jobId),
    with: { client: true, items: true },
  });
  if (!job) notFound();

  const totals = calcTotals(job.items, job.taxRate, job.discount);
  const setStatus = setJobCardStatus.bind(null, jobId);
  const removeJob = deleteJobCard.bind(null, jobId);
  const convert = convertJobCardToInvoice.bind(null, jobId);
  const sendAction = sendJobCardEmailAction.bind(null, jobId);

  return (
    <div>
      <PageHeader
        eyebrow={`Job card · ${job.client?.name}`}
        title={job.number}
        action={
          <div className="flex items-center gap-2">
            <StatusStamp status={job.status} />
            <a
              href={`/api/job-cards/pdf/${job.id}`}
              className="rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
              target="_blank"
            >
              Download PDF
            </a>
            <GhostLink href={`/job-cards/${job.id}/edit`}>Edit</GhostLink>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <Card>
            <h2 className="mb-1 font-display text-lg font-bold text-navy">{job.title}</h2>
            {job.description && <p className="mb-4 text-sm text-ink-soft">{job.description}</p>}

            <div className="mb-4 grid grid-cols-2 gap-4 text-sm text-ink-soft sm:grid-cols-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Opened</div>
                <div className="text-ink">{formatDate(job.openedDate)}</div>
              </div>
              {job.completedDate && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Completed</div>
                  <div className="text-ink">{formatDate(job.completedDate)}</div>
                </div>
              )}
              {job.technician && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Technician</div>
                  <div className="text-ink">{job.technician}</div>
                </div>
              )}
              {job.equipment && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em]">Equipment</div>
                  <div className="text-ink">{job.equipment}</div>
                </div>
              )}
            </div>

            {job.items.length > 0 && (
              <>
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
                    {job.items.map((it) => (
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
                    <div className="flex justify-between border-t border-rule pt-1.5 text-base font-semibold">
                      <span>Total</span>
                      <span className="font-mono">{money(totals.total)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {job.notes && <div className="mt-6 border-t border-rule pt-4 text-sm text-ink-soft">{job.notes}</div>}
          </Card>

          {job.convertedInvoiceId && (
            <p className="mt-4 text-sm text-ink-soft">
              Invoiced —{" "}
              <Link href={`/invoices/${job.convertedInvoiceId}`} className="text-forest hover:underline">
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
            <SendEmailForm action={sendAction} defaultTo={job.client?.email} buttonLabel="Send job card" />
            {job.lastSentAt && (
              <p className="mt-3 border-t border-rule pt-3 text-xs text-ink-soft">
                Last sent {formatDate(job.lastSentAt.toISOString())}
              </p>
            )}
          </Card>

          <Card>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Status</h3>
            <div className="flex flex-wrap gap-2">
              {(["open", "in_progress", "completed", "cancelled"] as const).map((s) => (
                <form key={s} action={setStatus.bind(null, s)}>
                  <button className="rounded-full border border-rule-strong px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-ink-soft hover:border-forest hover:text-forest">
                    mark {s.replace(/_/g, " ")}
                  </button>
                </form>
              ))}
            </div>
          </Card>

          {!job.convertedInvoiceId && job.items.length > 0 && (
            <Card>
              <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Ready to bill?</h3>
              <p className="mb-3 text-sm text-ink-soft">
                Turn the labour and parts on this job card into an invoice.
              </p>
              <form action={convert}>
                <button className="w-full rounded-md bg-forest px-4 py-2 text-sm font-medium text-paper hover:opacity-90">
                  Convert to invoice
                </button>
              </form>
            </Card>
          )}

          <Card>
            <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Client</h3>
            <p className="font-medium text-ink">{job.client?.name}</p>
            {job.client?.email && <p className="text-sm text-ink-soft">{job.client.email}</p>}
          </Card>

          <form action={removeJob}>
            <button className="w-full font-mono text-xs uppercase tracking-wide text-rust hover:underline">
              Delete job card
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
