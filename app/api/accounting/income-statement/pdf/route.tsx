import { getIncomeStatement } from "@/lib/ledger";
import { renderToBuffer } from "@react-pdf/renderer";
import { IncomeStatementPDF } from "@/components/pdf/AccountingPDF";
import { getSettings } from "@/lib/numbering";
import { companyFromSettings } from "@/lib/company";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const from = sp.get("from") ?? `${new Date().getFullYear()}-01-01`;
  const to = sp.get("to") ?? today;

  const [stmt, settings] = await Promise.all([getIncomeStatement(from, to), getSettings()]);

  const buffer = await renderToBuffer(
    <IncomeStatementPDF
      from={from}
      to={to}
      stmt={stmt}
      company={companyFromSettings(settings)}
      currency={settings.currency}
    />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="income-statement-${from}-to-${to}.pdf"`,
    },
  });
}