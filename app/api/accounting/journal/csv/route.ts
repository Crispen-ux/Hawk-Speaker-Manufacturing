import { db } from "@/db";
import { journalEntries } from "@/db/schema";
import { desc } from "drizzle-orm";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  const entries = await db.query.journalEntries.findMany({
    with: { lines: { with: { account: true } } },
    orderBy: [desc(journalEntries.date), desc(journalEntries.id)],
  });

  const out: (string | number)[][] = [
    ["Number", "Date", "Kind", "Memo", "Account", "Description", "Debit", "Credit"],
  ];
  let totalDebits = 0;
  let totalCredits = 0;
  for (const e of entries) {
    for (const l of e.lines) {
      const debit = Number(l.debit || 0);
      const credit = Number(l.credit || 0);
      totalDebits += debit;
      totalCredits += credit;
      out.push([
        e.number,
        formatIsoDate(e.date),
        e.kind,
        e.memo,
        l.account.code,
        l.account.name,
        debit > 0 ? debit.toFixed(2) : "",
        credit > 0 ? credit.toFixed(2) : "",
      ]);
    }
  }
  out.push(["", "", "", "", "Total", "", totalDebits.toFixed(2), totalCredits.toFixed(2)]);

  return new Response(toCsv(out), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="general-journal.csv"`,
    },
  });
}

function formatIsoDate(v: unknown): string {
  if (typeof v !== "string" || !v) return "";
  return v.slice(0, 10);
}