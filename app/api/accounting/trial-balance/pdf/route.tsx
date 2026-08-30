import { computeLedger, ACCOUNT_TYPE_LABELS } from "@/lib/ledger";
import type { AccountType } from "@/lib/ledger";
import { renderToBuffer } from "@react-pdf/renderer";
import { TrialBalancePDF } from "@/components/pdf/AccountingPDF";
import type { TbGroup, TbRow } from "@/components/pdf/AccountingPDF";
import { getSettings } from "@/lib/numbering";
import { companyFromSettings } from "@/lib/company";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPE_ORDER: AccountType[] = ["asset", "liability", "equity", "income", "expense"];

export async function GET(req: NextRequest) {
  const asOf = new URL(req.url).searchParams.get("asOf") ?? new Date().toISOString().slice(0, 10);
  const [ledger, settings] = await Promise.all([computeLedger(asOf), getSettings()]);

  const groups: TbGroup[] = TYPE_ORDER.map((type) => {
    const rows: TbRow[] = [];
    let debit = 0;
    let credit = 0;
    for (const r of ledger.rows.filter((x) => x.type === type)) {
      const d = r.signed > 0 ? r.signed : 0;
      const c = r.signed < 0 ? -r.signed : 0;
      debit += d;
      credit += c;
      rows.push({ code: r.code, name: r.name, debit: d, credit: c });
    }
    return { label: ACCOUNT_TYPE_LABELS[type], rows, debit, credit };
  });
  const totalDebits = groups.reduce((s, g) => s + g.debit, 0);
  const totalCredits = groups.reduce((s, g) => s + g.credit, 0);

  const buffer = await renderToBuffer(
    <TrialBalancePDF
      asOf={asOf}
      groups={groups}
      totalDebits={totalDebits}
      totalCredits={totalCredits}
      company={companyFromSettings(settings)}
      currency={settings.currency}
    />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="trial-balance-${asOf}.pdf"`,
    },
  });
}