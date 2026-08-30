import { getBalanceSheet } from "@/lib/ledger";
import { toCsv } from "@/lib/csv";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const asOf = new URL(req.url).searchParams.get("asOf") ?? new Date().toISOString().slice(0, 10);
  const bs = await getBalanceSheet(asOf);

  const out: (string | number)[][] = [["Section", "Code", "Line", "Amount"]];
  for (const l of bs.assets) out.push(["Assets", l.code ?? "", l.label, l.amount.toFixed(2)]);
  out.push(["Assets", "", "Total assets", bs.totalAssets.toFixed(2)]);
  for (const l of bs.liabilities) out.push(["Liabilities", l.code ?? "", l.label, l.amount.toFixed(2)]);
  out.push(["Liabilities", "", "Total liabilities", bs.totalLiabilities.toFixed(2)]);
  for (const l of bs.equity) out.push(["Equity", l.code ?? "", l.label, l.amount.toFixed(2)]);
  out.push(["Equity", "", "Total equity", bs.totalEquity.toFixed(2)]);

  return new Response(toCsv(out), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="balance-sheet-${asOf}.csv"`,
    },
  });
}