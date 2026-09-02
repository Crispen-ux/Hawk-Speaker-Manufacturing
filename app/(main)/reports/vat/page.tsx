import { generateVatReport, type VatReport } from "@/lib/actions/vat-report";
import { getSettings } from "@/lib/numbering";
import { formatMoney } from "@/lib/money";
import { PageHeader, Card } from "@/components/ui";
import { formatDate } from "@/lib/money";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VatReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; basis?: string }>;
}) {
  const params = await searchParams;
  const settings = await getSettings();
  const money = (v: number) => formatMoney(v, settings.currency || "R");

  const today = new Date();
  const defaultFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultTo = today.toISOString().slice(0, 10);

  const from = params.from || defaultFrom;
  const to = params.to || defaultTo;
  const basis = (params.basis as "accrual" | "cash") || "accrual";

  const report = await generateVatReport(from, to, basis);

  const paramsForUrl = (overrides: Record<string, string>) => {
    const p = new URLSearchParams({ from, to, basis, ...overrides });
    return `/reports/vat?${p.toString()}`;
  };

  return (
    <div>
      <PageHeader
        eyebrow="Tax"
        title="VAT report"
        action={
          <div className="flex items-center gap-2">
            <a
              href={`/api/reports/vat/pdf?from=${from}&to=${to}&basis=${basis}`}
              target="_blank"
              className="rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
            >
              Download PDF
            </a>
            <a
              href={`/api/reports/vat/csv?from=${from}&to=${to}&basis=${basis}`}
              className="rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim"
            >
              Export CSV
            </a>
          </div>
        }
      />

      <Card className="mb-6 max-w-4xl">
        <form className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">From</label>
            <input type="date" name="from" defaultValue={from} className="rounded-md border border-rule-strong bg-white px-3 py-1.5 text-sm font-mono" />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">To</label>
            <input type="date" name="to" defaultValue={to} className="rounded-md border border-rule-strong bg-white px-3 py-1.5 text-sm font-mono" />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">Basis</label>
            <select name="basis" defaultValue={basis} className="rounded-md border border-rule-strong bg-white px-3 py-1.5 text-sm">
              <option value="accrual">Accrual (invoice date)</option>
              <option value="cash">Cash (payment date)</option>
            </select>
          </div>
          <button type="submit" className="rounded-md bg-forest px-4 py-1.5 text-sm font-medium text-white hover:bg-forest-2">
            Run report
          </button>
        </form>
      </Card>

      <div className="mb-2 max-w-4xl text-xs text-ink-soft">
        {formatDate(from)} &mdash; {formatDate(to)} · {basis} basis
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4 max-w-4xl">
        <Card className="p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Output tax</div>
          <div className="mt-1 font-display text-xl font-bold text-navy">{money(report.totalOutputTax)}</div>
        </Card>
        <Card className="p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Input tax</div>
          <div className="mt-1 font-display text-xl font-bold text-navy">{money(report.totalInputTax)}</div>
        </Card>
        <Card className="p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">VAT payable</div>
          <div className={`mt-1 font-display text-xl font-bold ${report.vatPayable >= 0 ? "text-rust" : "text-success"}`}>
            {money(report.vatPayable)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Transactions</div>
          <div className="mt-1 font-display text-xl font-bold text-navy">{report.lines.length}</div>
        </Card>
      </div>

      <div className="mb-4 max-w-4xl grid grid-cols-3 gap-4">
        <div className="rounded-md border border-rule bg-paper-dim p-3 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">Standard rated</div>
          <div className="mt-1 font-mono text-sm font-semibold text-ink">{money(report.standardRatedTotal)}</div>
        </div>
        <div className="rounded-md border border-rule bg-paper-dim p-3 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">Zero-rated</div>
          <div className="mt-1 font-mono text-sm font-semibold text-ink">{money(report.zeroRatedTotal)}</div>
        </div>
        <div className="rounded-md border border-rule bg-paper-dim p-3 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">Exempt</div>
          <div className="mt-1 font-mono text-sm font-semibold text-ink">{money(report.exemptTotal)}</div>
        </div>
      </div>

      <Card className="max-w-4xl">
        {report.lines.length === 0 ? (
          <p className="text-sm text-ink-soft">No transactions found for this period.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-rule">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Number</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Client / Category</th>
                  <th className="px-4 py-2.5 font-medium">VAT</th>
                  <th className="px-4 py-2.5 text-right font-medium">Net</th>
                  <th className="px-4 py-2.5 text-right font-medium">Tax</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((l, i) => (
                  <tr key={i} className="border-b border-rule last:border-b-0">
                    <td className="px-4 py-2.5 font-mono text-xs">{l.kind}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{l.number}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{formatDate(l.date)}</td>
                    <td className="px-4 py-2.5">{l.clientOrSupplier}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-soft">{l.vatTreatment}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{money(l.netAmount)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{money(l.taxAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-rule bg-paper-dim font-semibold">
                  <td className="px-4 py-2.5" colSpan={5}>Total</td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {money(report.lines.reduce((s, l) => s + l.netAmount, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {money(report.lines.reduce((s, l) => s + l.taxAmount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
