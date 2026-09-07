import { db } from "@/db";
import { accounts, bankAccounts } from "@/db/schema";
import { asc, and, eq } from "drizzle-orm";
import { toNumber } from "@/lib/money";
import { ensureAccountingJournal } from "@/lib/accounting/migrate";
import { ensureAccountingInfrastructure, getAccountingPeriods } from "@/lib/accounting/control";

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = { asset: "Asset", liability: "Liability", equity: "Equity", income: "Income", expense: "Expense" };

const DEFAULT_ACCOUNTS: Array<{ code: string; name: string; type: AccountType; description?: string; isSystem?: boolean; sortOrder: number }> = [
  { code: "1000", name: "Bank & cash", type: "asset", isSystem: true, sortOrder: 10 },
  { code: "1100", name: "Trade receivables", type: "asset", isSystem: true, sortOrder: 20 },
  { code: "1200", name: "Inventory", type: "asset", isSystem: true, sortOrder: 30 },
  { code: "1300", name: "Property, plant & equipment", type: "asset", isSystem: true, sortOrder: 40 },
  { code: "2000", name: "Trade payables", type: "liability", isSystem: true, sortOrder: 50 },
  { code: "2100", name: "VAT payable / receivable", type: "liability", isSystem: true, sortOrder: 60 },
  { code: "2200", name: "Payroll tax & deductions payable", type: "liability", isSystem: true, sortOrder: 70 },
  { code: "2300", name: "UIF payable", type: "liability", isSystem: true, sortOrder: 80 },
  { code: "3000", name: "Owner's capital", type: "equity", isSystem: true, sortOrder: 90 },
  { code: "3100", name: "Retained earnings", type: "equity", isSystem: true, sortOrder: 100 },
  { code: "4000", name: "Sales & services", type: "income", isSystem: true, sortOrder: 110 },
  { code: "5000", name: "Salaries & wages", type: "expense", isSystem: true, sortOrder: 120 },
  { code: "5100", name: "Operating expenses", type: "expense", isSystem: true, sortOrder: 130 },
  { code: "5200", name: "General & administrative", type: "expense", sortOrder: 140 },
  { code: "5300", name: "Rent & utilities", type: "expense", sortOrder: 150 },
  { code: "5400", name: "Fuel & transport", type: "expense", sortOrder: 160 },
  { code: "5500", name: "Materials & supplies", type: "expense", sortOrder: 170 },
  { code: "5600", name: "Marketing & advertising", type: "expense", sortOrder: 180 },
  { code: "5700", name: "Insurance", type: "expense", sortOrder: 190 },
];

const DEFAULT_BANKS = [{ name: "Business bank account", bankName: "Bank", openingBalance: "0", isDefault: true }];

export async function ensureLedgerSeed() {
  await db.insert(accounts).values(DEFAULT_ACCOUNTS).onConflictDoNothing({ target: accounts.code });
  const banks = await db.select({ id: bankAccounts.id }).from(bankAccounts).limit(1);
  if (!banks.length) await db.insert(bankAccounts).values(DEFAULT_BANKS);
}

export type LedgerAccount = (typeof accounts.$inferSelect) & { balance: number; debit: number; credit: number };

export async function getExpenseAccounts() {
  await ensureLedgerSeed();
  return db.select().from(accounts).where(and(eq(accounts.type, "expense"), eq(accounts.active, true))).orderBy(asc(accounts.sortOrder), asc(accounts.code));
}

export async function getChartOfAccounts() {
  await ensureLedgerSeed();
  return db.select().from(accounts).where(eq(accounts.active, true)).orderBy(asc(accounts.sortOrder), asc(accounts.code));
}

export type SignedRow = { code: string; name: string; type: AccountType; isSystem: boolean; signed: number; source: string };
export type LedgerResult = { rows: SignedRow[]; assets: number; liabilities: number; income: number; expenses: number; netProfit: number; capital: number; retainedEarnings: number; balanced: boolean; imbalance: number };

function dateOk(date: string, asOf?: string) { return !asOf || date.slice(0, 10) <= asOf; }

export async function computeLedger(asOf?: string): Promise<LedgerResult> {
  await ensureLedgerSeed();
  await ensureAccountingInfrastructure();
  await ensureAccountingJournal();
  const [accountRows, entries] = await Promise.all([
    db.select().from(accounts),
    db.query.journalEntries.findMany({ with: { lines: true } }),
  ]);
  const byAccount = new Map<number, number>();
  const sourceByAccount = new Map<number, Set<string>>();
  let totalDebit = 0;
  let totalCredit = 0;
  for (const entry of entries) {
    if (!dateOk(entry.date, asOf)) continue;
    for (const line of entry.lines) {
      const debit = toNumber(line.debit);
      const credit = toNumber(line.credit);
      totalDebit += debit; totalCredit += credit;
      byAccount.set(line.accountId, (byAccount.get(line.accountId) ?? 0) + debit - credit);
      const source = sourceByAccount.get(line.accountId) ?? new Set<string>();
      source.add(entry.reference ?? entry.number); sourceByAccount.set(line.accountId, source);
    }
  }
  const rows: SignedRow[] = accountRows.map((account) => ({
    code: account.code, name: account.name, type: account.type as AccountType, isSystem: account.isSystem,
    signed: Number((byAccount.get(account.id) ?? 0).toFixed(2)), source: Array.from(sourceByAccount.get(account.id) ?? []).slice(0, 8).join(", "),
  })).filter((row) => Math.abs(row.signed) >= 0.005).sort((a, b) => a.code.localeCompare(b.code));
  const assets = rows.filter((r) => r.type === "asset").reduce((s, r) => s + r.signed, 0);
  const liabilities = rows.filter((r) => r.type === "liability").reduce((s, r) => s + r.signed, 0);
  const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + r.signed, 0);
  const expenses = rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.signed, 0);
  const capital = -(rows.find((r) => r.code === "3000")?.signed ?? 0);
  const retainedEarnings = -(rows.find((r) => r.code === "3100")?.signed ?? 0);
  const netProfit = -(income + expenses);
  const imbalance = Number((totalDebit - totalCredit).toFixed(2));
  return { rows, assets, liabilities, income, expenses, netProfit, capital, retainedEarnings, balanced: Math.abs(imbalance) < 0.01, imbalance };
}

export type ProfitLine = { label: string; amount: number; code?: string; kind: "revenue" | "expense" };
export type IncomeStatement = { from: string; to: string; revenue: ProfitLine[]; expenses: ProfitLine[]; revenueTotal: number; expenseTotal: number; netProfit: number };

export async function getIncomeStatement(from: string, to: string): Promise<IncomeStatement> {
  await ensureLedgerSeed();
  await ensureAccountingInfrastructure();
  await ensureAccountingJournal();
  const [accountRows, entries] = await Promise.all([
    db.select().from(accounts),
    db.query.journalEntries.findMany({ with: { lines: true } }),
  ]);
  const byCode = new Map(accountRows.map((a) => [a.id, a]));
  const revenueByCode = new Map<string, ProfitLine>();
  const expenseByCode = new Map<string, ProfitLine>();

  for (const entry of entries) {
    if (entry.date < from || entry.date > to) continue;
    for (const line of entry.lines) {
      const account = byCode.get(line.accountId);
      if (!account) continue;
      const signed = toNumber(line.debit) - toNumber(line.credit);
      if (account.type === "income") {
        const current = revenueByCode.get(account.code) ?? { label: account.name, amount: 0, code: account.code, kind: "revenue" as const };
        current.amount += -signed;
        revenueByCode.set(account.code, current);
      } else if (account.type === "expense") {
        const current = expenseByCode.get(account.code) ?? { label: account.name, amount: 0, code: account.code, kind: "expense" as const };
        current.amount += signed;
        expenseByCode.set(account.code, current);
      }
    }
  }

  const revenue = Array.from(revenueByCode.values()).filter((l) => Math.abs(l.amount) >= 0.01).sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));
  const expenses = Array.from(expenseByCode.values()).filter((l) => Math.abs(l.amount) >= 0.01).sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));
  const revenueTotal = revenue.reduce((s, l) => s + l.amount, 0);
  const expenseTotal = expenses.reduce((s, l) => s + l.amount, 0);
  return { from, to, revenue, expenses, revenueTotal, expenseTotal, netProfit: revenueTotal - expenseTotal };
}

export type BsLine = { label: string; amount: number; code?: string };
export type BalanceSheet = { asOf: string; assets: BsLine[]; liabilities: BsLine[]; equity: BsLine[]; totalAssets: number; totalLiabilities: number; totalEquity: number };

export async function getBalanceSheet(asOf: string): Promise<BalanceSheet> {
  const l = await computeLedger(asOf);
  const assets: BsLine[] = [];
  const liabilities: BsLine[] = [];
  const equity: BsLine[] = [];
  for (const row of l.rows) {
    if (row.type === "asset" && row.signed > 0) assets.push({ label: row.name, amount: row.signed, code: row.code });
    if (row.type === "liability" && row.signed < 0) liabilities.push({ label: row.name, amount: -row.signed, code: row.code });
  }
  const totalAssets = assets.reduce((s, x) => s + x.amount, 0);
  const totalLiabilities = liabilities.reduce((s, x) => s + x.amount, 0);
  const capital = l.capital;
  const retained = l.retainedEarnings + l.netProfit;
  if (Math.abs(capital) >= 0.01) equity.push({ label: capital >= 0 ? "Owner's capital" : "Capital deficit", amount: capital, code: "3000" });
  if (Math.abs(retained) >= 0.01) equity.push({ label: retained >= 0 ? "Retained earnings / current profit" : "Accumulated loss", amount: retained, code: "3100" });
  const totalEquity = equity.reduce((s, x) => s + x.amount, 0);
  return { asOf, assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
}

export async function getReceivables(asOf?: string) {
  await ensureLedgerSeed();
  await ensureAccountingJournal();
  const [account] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, "1100")).limit(1);
  if (!account) return 0;
  const entries = await db.query.journalEntries.findMany({ with: { lines: true } });
  let balance = 0;
  for (const entry of entries) if (dateOk(entry.date, asOf)) for (const line of entry.lines) if (line.accountId === account.id) balance += toNumber(line.debit) - toNumber(line.credit);
  return Number(balance.toFixed(2));
}

export async function getPayables(asOf?: string) {
  await ensureLedgerSeed();
  await ensureAccountingJournal();
  const [account] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, "2000")).limit(1);
  if (!account) return 0;
  const entries = await db.query.journalEntries.findMany({ with: { lines: true } });
  const balance = entries.filter((e) => dateOk(e.date, asOf)).flatMap((e) => e.lines).filter((l) => l.accountId === account.id).reduce((s, l) => s + toNumber(l.credit) - toNumber(l.debit), 0);
  return Number(balance.toFixed(2));
}

export async function getVatSummary(from: string, to: string) {
  await ensureLedgerSeed();
  await ensureAccountingJournal();
  const [account] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, "2100")).limit(1);
  if (!account) return { from, to, outputVat: 0, inputVat: 0, netVat: 0 };
  const entries = await db.query.journalEntries.findMany({ with: { lines: true } });
  let output = 0;
  let input = 0;
  for (const entry of entries) {
    if (entry.date < from || entry.date > to) continue;
    for (const line of entry.lines) if (line.accountId === account.id) { output += toNumber(line.credit); input += toNumber(line.debit); }
  }
  return { from, to, outputVat: Number(output.toFixed(2)), inputVat: Number(input.toFixed(2)), netVat: Number((output - input).toFixed(2)) };
}

export async function getAccountingIntegrity() {
  await ensureAccountingInfrastructure();
  const entries = await db.query.journalEntries.findMany({ with: { lines: true } });
  const errors: string[] = [];
  const references = new Map<string, number>();
  let debitTotal = 0;
  let creditTotal = 0;
  for (const entry of entries) {
    let debit = 0;
    let credit = 0;
    if (entry.reference) references.set(entry.reference, (references.get(entry.reference) ?? 0) + 1);
    if (entry.lines.length < 2) errors.push(`${entry.number}: fewer than two journal lines`);
    for (const line of entry.lines) {
      debit += toNumber(line.debit);
      credit += toNumber(line.credit);
      if (toNumber(line.debit) > 0 && toNumber(line.credit) > 0) errors.push(`${entry.number}: line has both debit and credit`);
    }
    if (Math.abs(debit - credit) >= 0.01) errors.push(`${entry.number}: Dr ${debit.toFixed(2)} / Cr ${credit.toFixed(2)}`);
    debitTotal += debit;
    creditTotal += credit;
  }
  for (const [reference, count] of references) if (count > 1) errors.push(`Duplicate accounting reference: ${reference}`);
  const difference = Number((debitTotal - creditTotal).toFixed(2));
  if (Math.abs(difference) >= 0.01) errors.push(`Global journal imbalance: ${difference.toFixed(2)}`);
  return { ok: errors.length === 0, errors, entries: entries.length, debitTotal: Number(debitTotal.toFixed(2)), creditTotal: Number(creditTotal.toFixed(2)), periods: await getAccountingPeriods() };
}
