import { computeLedger, ACCOUNT_TYPE_LABELS } from "@/lib/ledger";
import type { AccountType } from "@/lib/ledger";
import { toCsv } from "@/lib/csv";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const TYPE_ORDER: AccountType[] = ["asset", "liability", "equity", "income", "expense"];

export async function GET(req: NextRequest) {
  const asOf = new URL(req.url).searchParams.get("asOf") ?? new Date().toISOString().slice(0, 10);
  const ledger = await computeLedger(asOf);

  const out: (string | number)[][] = [["Code", "Account", "Type", "Debit", "Credit"]];
  let totalDebits = 0;
  let totalCredits = 0;
  for (const type of TYPE_ORDER) {
    let d = 0;
    let c = 0;
    for (const r of ledger.rows.filter((x) => x.type === type)) {
      const debit = r.signed > 0 ? r.signed : 0;
      const credit = r.signed < 0 ? -r.signed : 0;
      if (debit || credit) {
        d += debit;
        c += credit;
      }
      out.push([r.code, r.name, ACCOUNT_TYPE_LABELS[r.type], debit > 0 ? debit.toFixed(2) : "", credit > 0 ? credit.toFixed(2) : ""]);
    }
    out.push(["", `${ACCOUNT_TYPE_LABELS[type]} total`, "", d.toFixed(2), c.toFixed(2)]);
    totalDebits += d;
    totalCredits += c;
  }
  out.push(["", "Total", "", totalDebits.toFixed(2), totalCredits.toFixed(2)]);

  return new Response(toCsv(out), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trial-balance-${asOf}.csv"`,
    },
  });
}