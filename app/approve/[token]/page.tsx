import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { quotations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveDocumentLink } from "@/lib/public-links";
import { getSettings } from "@/lib/numbering";
import { formatMoney, formatDate, calcTotals } from "@/lib/money";
import { companyFromSettings } from "@/lib/company";
import { ToastProvider } from "@/components/ToastProvider";
import { sharedApproveQuotation, sharedDeclineQuotation } from "@/lib/actions/shared-approval";

export const dynamic = "force-dynamic";

export default async function SharedApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const meta = await resolveDocumentLink(token);
  if (!meta || meta.kind !== "quotation") notFound();

  const quote = await db.query.quotations.findFirst({
    where: eq(quotations.id, meta.documentId),
    with: { client: true, items: true },
  });
  if (!quote) notFound();

  const settings = await getSettings();
  const fmt = (n: string | number) => formatMoney(n, settings.currency || "R");
  const totals = calcTotals(quote.items, quote.taxRate, quote.discount);
  const company = companyFromSettings(settings);

  const decided =
    quote.status === "accepted" ||
    quote.status === "declined" ||
    quote.status === "expired";

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#F7F8FA]">
        <header className="border-b border-rule bg-white">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-5">
            <div className="font-display text-lg font-extrabold text-navy">{company.companyName}</div>
            <Link
              href={`/shared/${token}`}
              className="text-sm font-semibold text-navy hover:text-navy-2"
            >
              View PDF
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-6 py-10">
          <div className="mb-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
              Quotation
            </div>
            <h1 className="mt-1 font-display text-2xl font-extrabold text-navy">{quote.number}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {quote.client?.name ? `Prepared for ${quote.client.name} · ` : ""}
              Total <span className="font-semibold text-ink">{fmt(totals.total)}</span> · Valid until{" "}
              {formatDate(quote.expiryDate)}
            </p>
          </div>

          <div className="card-elevated rounded-lg border border-rule bg-white p-6">
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
                  <td className="py-2 text-right font-display text-lg font-extrabold text-navy">
                    {fmt(totals.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-6">
            {decided ? (
              <div className="card-elevated rounded-lg border border-rule bg-white p-6 text-center">
                <p className="font-semibold text-navy">
                  {quote.status === "accepted" &&
                    `✓ This quotation was approved${quote.approvedAt ? ` on ${formatDate(quote.approvedAt)}` : ""}.`}
                  {quote.status === "declined" && "This quotation was declined. No further action is needed."}
                  {quote.status === "expired" && "This quotation has expired and can no longer be approved."}
                </p>
                {quote.declineReason && quote.status === "declined" && (
                  <p className="mt-2 text-sm text-ink-soft">Reason: {quote.declineReason}</p>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <form action={sharedApproveQuotation}>
                  <input type="hidden" name="token" value={token} />
                  <button
                    type="submit"
                    className="w-full rounded-md bg-success px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-95"
                  >
                    Approve quotation
                  </button>
                </form>

                <details className="card-elevated rounded-lg border border-rule bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-rust">
                    Decline quotation…
                  </summary>
                  <form action={sharedDeclineQuotation} className="mt-3 space-y-3">
                    <input type="hidden" name="token" value={token} />
                    <textarea
                      name="reason"
                      required
                      rows={3}
                      placeholder="Let us know why you're declining (optional comment for us)"
                      className="w-full rounded-md border border-rule bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-md bg-rust px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-95"
                    >
                      Confirm decline
                    </button>
                  </form>
                </details>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-ink-soft">
            Questions? Contact {company.email ? `${company.email} · ` : ""}
            {company.phone ?? ""}
          </p>
        </main>
      </div>
    </ToastProvider>
  );
}
