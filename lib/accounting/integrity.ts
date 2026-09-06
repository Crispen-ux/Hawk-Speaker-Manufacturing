import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ensureAccountingInfrastructure } from "@/lib/accounting/control";

export type IntegrityCheck = {
  id: string;
  name: string;
  ok: boolean;
  detail: string;
};

/**
 * Read-only accounting health checks. These never create, edit or delete
 * financial records and are safe to run from an admin health endpoint.
 */
export async function runAccountingIntegrityChecks(): Promise<IntegrityCheck[]> {
  await ensureAccountingInfrastructure();

  const [balance, orphanLines, duplicateRefs, missingAccounts, periods] = await Promise.all([
    db.execute(sql`
      SELECT COALESCE(SUM(jl.debit), 0) AS debits,
             COALESCE(SUM(jl.credit), 0) AS credits
      FROM journal_lines jl
    `),
    db.execute(sql`
      SELECT COUNT(*) AS count
      FROM journal_lines jl
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE je.id IS NULL
    `),
    db.execute(sql`
      SELECT COUNT(*) AS count
      FROM (
        SELECT reference
        FROM journal_entries
        WHERE reference IS NOT NULL
        GROUP BY reference
        HAVING COUNT(*) > 1
      ) duplicates
    `),
    db.execute(sql`
      SELECT COUNT(*) AS count
      FROM journal_lines jl
      LEFT JOIN accounts a ON a.id = jl.account_id
      WHERE a.id IS NULL
    `),
    db.execute(sql`
      SELECT COUNT(*) AS count
      FROM accounting_periods
      WHERE start_date > end_date
         OR status NOT IN ('open', 'closed')
    `),
  ]);

  const debits = Number(balance.rows[0]?.debits ?? 0);
  const credits = Number(balance.rows[0]?.credits ?? 0);
  const orphanCount = Number(orphanLines.rows[0]?.count ?? 0);
  const duplicateCount = Number(duplicateRefs.rows[0]?.count ?? 0);
  const missingAccountCount = Number(missingAccounts.rows[0]?.count ?? 0);
  const periodErrorCount = Number(periods.rows[0]?.count ?? 0);
  const difference = Math.abs(debits - credits);

  return [
    {
      id: "journal-balanced",
      name: "General ledger balances",
      ok: difference < 0.005,
      detail: `Debits ${debits.toFixed(2)} / credits ${credits.toFixed(2)}`,
    },
    {
      id: "orphan-lines",
      name: "No orphan journal lines",
      ok: orphanCount === 0,
      detail: `${orphanCount} orphan line(s)`,
    },
    {
      id: "unique-references",
      name: "Posting references are unique",
      ok: duplicateCount === 0,
      detail: `${duplicateCount} duplicate reference group(s)`,
    },
    {
      id: "valid-accounts",
      name: "Journal lines reference valid accounts",
      ok: missingAccountCount === 0,
      detail: `${missingAccountCount} missing account reference(s)`,
    },
    {
      id: "period-controls",
      name: "Accounting periods are valid",
      ok: periodErrorCount === 0,
      detail: `${periodErrorCount} invalid period(s)`,
    },
  ];
}
