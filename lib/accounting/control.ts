import { db } from "@/db";
import { sql } from "drizzle-orm";

let ready = false;

/** Creates Phase 1 accounting-control tables without requiring a separate deploy-time DB step. */
export async function ensureAccountingInfrastructure() {
  if (ready) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS accounting_periods (
      id serial PRIMARY KEY,
      name varchar(128) NOT NULL,
      start_date date NOT NULL,
      end_date date NOT NULL,
      status varchar(16) NOT NULL DEFAULT 'open',
      closed_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT accounting_periods_dates_ck CHECK (start_date <= end_date),
      CONSTRAINT accounting_periods_status_ck CHECK (status IN ('open','closed'))
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bank_transactions (
      id serial PRIMARY KEY,
      bank_account_id integer NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
      txn_date date NOT NULL,
      description varchar(256) NOT NULL,
      reference varchar(128),
      amount numeric(14,2) NOT NULL,
      direction varchar(8) NOT NULL,
      matched_journal_entry_id integer REFERENCES journal_entries(id) ON DELETE SET NULL,
      reconciled boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT bank_transactions_direction_ck CHECK (direction IN ('in','out')),
      CONSTRAINT bank_transactions_amount_ck CHECK (amount >= 0)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS bank_transactions_reconcile_idx ON bank_transactions(bank_account_id, txn_date, reconciled)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS journal_entries_reference_idx ON journal_entries(reference)`);
  const periods = await db.execute(sql`SELECT id FROM accounting_periods LIMIT 1`);
  if (periods.rows.length === 0) {
    const year = new Date().getUTCFullYear();
    await db.execute(sql`INSERT INTO accounting_periods (name, start_date, end_date, status) VALUES (${`FY ${year}`}, ${`${year}-01-01`}, ${`${year}-12-31`}, 'open')`);
  }
  ready = true;
}

export async function assertAccountingPeriodOpen(date: string) {
  await ensureAccountingInfrastructure();
  const result = await db.execute(sql`
    SELECT id FROM accounting_periods
    WHERE ${date}::date BETWEEN start_date AND end_date AND status = 'open'
    ORDER BY start_date DESC LIMIT 1
  `);
  if (result.rows.length === 0) throw new Error(`Accounting period is closed or does not exist for ${date}`);
}

export async function getAccountingPeriods() {
  await ensureAccountingInfrastructure();
  const result = await db.execute(sql`SELECT id, name, start_date, end_date, status, closed_at, created_at FROM accounting_periods ORDER BY start_date DESC`);
  return result.rows;
}

export async function setAccountingPeriodStatus(id: number, status: "open" | "closed") {
  await ensureAccountingInfrastructure();
  const existing = await db.execute(sql`SELECT id, start_date, end_date, status FROM accounting_periods WHERE id = ${id} LIMIT 1`);
  if (!existing.rows.length) throw new Error("Accounting period not found");
  if (status === "open") {
    const overlap = await db.execute(sql`SELECT id FROM accounting_periods WHERE id <> ${id} AND status = 'open' AND start_date <= (SELECT end_date FROM accounting_periods WHERE id = ${id}) AND end_date >= (SELECT start_date FROM accounting_periods WHERE id = ${id}) LIMIT 1`);
    if (overlap.rows.length) throw new Error("Cannot re-open this period while another open period overlaps it");
  }
  await db.execute(status === "closed"
    ? sql`UPDATE accounting_periods SET status = 'closed', closed_at = now() WHERE id = ${id}`
    : sql`UPDATE accounting_periods SET status = 'open', closed_at = NULL WHERE id = ${id}`);
}

export async function getBankTransactions(bankAccountId?: number) {
  await ensureAccountingInfrastructure();
  const result = bankAccountId
    ? await db.execute(sql`SELECT bt.*, ba.name AS bank_account_name FROM bank_transactions bt JOIN bank_accounts ba ON ba.id = bt.bank_account_id WHERE bt.bank_account_id = ${bankAccountId} ORDER BY bt.txn_date DESC, bt.id DESC`)
    : await db.execute(sql`SELECT bt.*, ba.name AS bank_account_name FROM bank_transactions bt JOIN bank_accounts ba ON ba.id = bt.bank_account_id ORDER BY bt.txn_date DESC, bt.id DESC`);
  return result.rows;
}

export async function importBankTransactions(rows: Array<{
  bankAccountId: number;
  date: string;
  description: string;
  reference?: string | null;
  amount: number;
  direction: "in" | "out";
}>) {
  await ensureAccountingInfrastructure();
  if (!rows.length) return 0;
  let inserted = 0;
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error(`Invalid bank transaction date: ${row.date}`);
    if (!Number.isFinite(row.amount) || row.amount < 0) throw new Error("Bank transaction amount must be zero or greater");
    await db.execute(sql`INSERT INTO bank_transactions (bank_account_id, txn_date, description, reference, amount, direction) VALUES (${row.bankAccountId}, ${row.date}, ${row.description.trim().slice(0, 256)}, ${row.reference ?? null}, ${row.amount.toFixed(2)}, ${row.direction})`);
    inserted++;
  }
  return inserted;
}

export async function reconcileBankTransaction(id: number, journalEntryId: number) {
  await ensureAccountingInfrastructure();
  const transaction = await db.execute(sql`SELECT id, txn_date, amount, direction, reconciled FROM bank_transactions WHERE id = ${id} LIMIT 1`);
  if (!transaction.rows.length) throw new Error("Bank transaction not found");
  const bankTxn = transaction.rows[0] as { id: number; txn_date: string; amount: string; direction: string; reconciled: boolean };
  if (bankTxn.reconciled) throw new Error("Bank transaction is already reconciled");

  const journal = await db.execute(sql`
    SELECT je.id, je.date, COALESCE(SUM(jl.debit) FILTER (WHERE a.code = '1000'), 0) AS bank_debit,
           COALESCE(SUM(jl.credit) FILTER (WHERE a.code = '1000'), 0) AS bank_credit
    FROM journal_entries je
    LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
    LEFT JOIN accounts a ON a.id = jl.account_id
    WHERE je.id = ${journalEntryId}
    GROUP BY je.id, je.date
    LIMIT 1
  `);
  if (!journal.rows.length) throw new Error("Journal entry not found");
  const j = journal.rows[0] as { id: number; date: string; bank_debit: string; bank_credit: string };
  const debit = Number(j.bank_debit ?? 0);
  const credit = Number(j.bank_credit ?? 0);
  const journalAmount = bankTxn.direction === "in" ? debit : credit;
  const oppositeAmount = bankTxn.direction === "in" ? credit : debit;
  if (Math.abs(journalAmount - Number(bankTxn.amount)) >= 0.01 || oppositeAmount > 0.005) {
    throw new Error(`Bank transaction does not match journal entry ${journalEntryId} on account 1000`);
  }
  if (String(j.date).slice(0, 10) !== String(bankTxn.txn_date).slice(0, 10)) throw new Error("Bank transaction date must match the journal entry date");
  const used = await db.execute(sql`SELECT id FROM bank_transactions WHERE matched_journal_entry_id = ${journalEntryId} LIMIT 1`);
  if (used.rows.length) throw new Error("That journal entry is already reconciled to another bank transaction");
  await db.execute(sql`UPDATE bank_transactions SET matched_journal_entry_id = ${journalEntryId}, reconciled = true WHERE id = ${id}`);
}

export async function unreconcileBankTransaction(id: number) {
  await ensureAccountingInfrastructure();
  await db.execute(sql`UPDATE bank_transactions SET matched_journal_entry_id = NULL, reconciled = false WHERE id = ${id}`);
}
