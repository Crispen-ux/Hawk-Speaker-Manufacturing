import { PageHeader, Card } from "@/components/ui";
import { getBalanceSheet } from "@/lib/ledger";
import type { BsLine } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import DownloadLinks from "@/components/DownloadLinks";

export const dynamic = "force-dynamic";

function Section({
  title,
  lines,
  total,
  money,
}: {
  title: string;
  lines: BsLine[];
  total: number;
  money: (v: number) => string;
}) {
  return (
    <Card className="p-0">
      <div className="bg-paper-dim px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
        {title}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {lines.map((l) => (
            <tr key={`${l.code}-${l.label}`} className="border-b border-rule last:border-b-0">
              <td className="px-4 py-2.5 text-ink">
                <span className="mr-3 inline-block w-12 font-mono text-ink-soft">{l.code ?? ""}</span>
                <span className="font-medium">{l.label}</span>
              </td>
              <td className="px-4 py-2.5 text-right font-mono">{money(l.amount)}</td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td className="px-4 py-3 text-xs text-ink-soft">—</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-rule bg-paper-dim/60">
            <td className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">Total {title}</td>
            <td className="px-4 py-2.5 text-right font-mono font-semibold">{money(total)}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const asOf = sp.asOf || today;
  const settings = await getSettings();
  const money = (v: number) => formatMoney(v, settings.currency || "R");
  const bs = await getBalanceSheet(asOf);

  const difference = Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity));

  return (
    <div>
      <PageHeader
        eyebrow="Statement of financial position"
        title="Balance sheet"
        action={
          <div className="flex items-end gap-2">
            <form method="get" className="flex items-end gap-2">
              <label className="block">
                <span className="mb-1.5 mr-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
                  As at
                </span>
                <input
                  type="date"
                  name="asOf"
                  defaultValue={asOf}
                  className="rounded-md border border-rule-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest"
                />
              </label>
              <button className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-paper hover:bg-navy-2">Run</button>
            </form>
            <DownloadLinks
              csv={`/api/accounting/balance-sheet/csv?asOf=${asOf}`}
              pdf={`/api/accounting/balance-sheet/pdf?asOf=${asOf}`}
            />
          </div>
        }
      />

      <p className="mb-5 text-xs text-ink-soft">
        Assets = Liabilities + Equity. Inventory and closing stock are valued at catalogue price (an estimate
        until cost prices are tracked).
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Section title="Assets" lines={bs.assets} total={bs.totalAssets} money={money} />
        <Section title="Liabilities" lines={bs.liabilities} total={bs.totalLiabilities} money={money} />
        <Section title="Equity" lines={bs.equity} total={bs.totalEquity} money={money} />
      </div>

      <Card className={`mt-6 flex items-center justify-between border-rule p-5 ${difference < 0.01 ? "" : "border-rust"}`}>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
          {difference < 0.01 ? "Statement balanced" : "Statement out of balance"}
        </span>
        <span className={`font-display text-lg font-bold ${difference < 0.01 ? "text-forest" : "text-rust"}`}>
          {money(Math.max(bs.totalAssets, bs.totalLiabilities + bs.totalEquity))}
        </span>
      </Card>
    </div>
  );
}