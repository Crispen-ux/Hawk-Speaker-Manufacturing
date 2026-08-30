import { getIncomeStatement } from "@/lib/ledger";
import { toCsv } from "@/lib/csv";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const from = sp.get("from") ?? `${new Date().getFullYear()}-01-01`;
  const to = sp.get("to") ?? today;
  const stmt = await getIncomeStatement(from, to);

  const out: (string | number)[][] = [["Line", "Code", "Section", "Amount"]];
  for (const l of stmt.revenue) out.push([l.label, l.code ?? "", "Revenue", l.amount.toFixed(2)]);
  out.push(["Total revenue", "", "Revenue", stmt.revenueTotal.toFixed(2)]);
  for (const l of stmt.expenses) out.push([l.label, l.code ?? "", "Expenses", l.amount.toFixed(2)]);
  out.push(["Total expenses", "", "Expenses", stmt.expenseTotal.toFixed(2)]);
  out.push([`Net ${stmt.netProfit >= 0 ? "profit" : "loss"}`, "", "", stmt.netProfit.toFixed(2)]);

  return new Response(toCsv(out), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="income-statement-${from}-to-${to}.csv"`,
    },
  });
}