import { db } from "@/db";
import { and, asc, eq } from "drizzle-orm";
import { accounts, assets, bankAccounts, expenses } from "@/db/schema";
import { calcTotals, toNumber } from "@/lib/money";

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  income: "Income",
  expense: "Expense",
};

// Default chart of accounts. `isSystem` accounts are driven automatically by
// the app's sub-ledgers; the rest can be picked when tagging expenses.
const DEFAULT_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: AccountType;
  description?: string;
  isSystem?: boolean;
  sortOrder: number;
}> = [
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

const DEFAULT_BANKS: Array<{
  name: string;
  bankName: string;
  openingBalance: string;
  isDefault: boolean;
}> = [{ name: "Business bank account", bankName: "Bank", openingBalance: "0", isDefault: true }];

/** Idempotently seed the chart of accounts and a default bank account. */
export async function ensureLedgerSeed() {
  await db.insert(accounts).values(DEFAULT_ACCOUNTS).onConflictDoNothing({ target: accounts.code });
  const banks = await db.select({ id: bankAccounts.id }).from(bankAccounts).limit(1);
  if (!banks.length) await db.insert(bankAccounts).values(DEFAULT_BANKS);
}

export type LedgerAccount = (typeof accounts.$inferSelect) & { balance: number; debit: number; credit: number };

export async function getExpenseAccounts() {
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.type, "expense"), eq(accounts.active, true)))
    .orderBy(asc(accounts.sortOrder), asc(accounts.code));
}

// Free-text expense categories are mapped to accounts when no account was
// chosen, so historical expenses still land somewhere sensible.
const CATEGORY_ACCOUNT_MAP: Array<[RegExp, string]> = [
  [/fuel|diesel|petrol|transport|travel|bakkie|vehicle/i, "5400"],
  [/rent|utilities|light|water|electr/i, "5300"],
  [/material|suppl|tools|stock|parts/i, "5500"],
  [/market|advert|promo|social/i, "5600"],
  [/insurance/i, "5700"],
  [/wage|salary|labour|labor|payroll/i, "5000"],
  [/admin|office|stationery|software|bank?charges/i, "5200"],
];

async function resolveExpenseAccount(
  accountId: number | null,
  category: string | null,
  systemOperatingId: number
): Promise<number> {
  if (accountId) return accountId;
  const accRows = await db.select({ code: accounts.code, id: accounts.id }).from(accounts);
  for (const [re, code] of CATEGORY_ACCOUNT_MAP) {
    if (category && re.test(category)) {
      const hit = accRows.find((a) => a.code === code);
      if (hit) return hit.id;
    }
  }
  return systemOperatingId;
}

type Totaled = { subtotal: number; tax: number; total: number };

function totals(doc: { taxRate: string; discount: string; items: { quantity: string; unitPrice: string }[] }): Totaled {
  return calcTotals(doc.items, doc.taxRate, doc.discount);
}

// One signed figure per account. Signed as debit-positive, so credits are
// negative. Every business event posts in balanced pairs, so the sum of the
// signed figures is zero and the trial balance squares itself.
export type SignedRow = {
  code: string;
  name: string;
  type: AccountType;
  isSystem: boolean;
  signed: number;
  source: string;
};

export type LedgerResult = {
  rows: SignedRow[];
  assets: number;
  liabilities: number;
  income: number;
  expenses: number;
  netProfit: number;
  capital: number;
};

function le(d: string | Date | null | undefined, asOf?: string): boolean {
  if (!asOf) return true;
  if (!d) return true;
  return String(d).slice(0, 10) <= asOf;
}

export async function computeLedger(asOf?: string): Promise<LedgerResult> {
  await ensureLedgerSeed();

  const [
    accountRows,
    bankRows,
    invRows,
    cnRows,
    expenseRows,
    poRows,
    runRows,
    assetRows,
    catRows,
  ] = await Promise.all([
    db.select().from(accounts),
    db.select().from(bankAccounts),
    db.query.invoices.findMany({ with: { items: true, payments: true } }),
    db.query.creditNotes.findMany({ with: { items: true } }),
    db.select().from(expenses),
    db.query.purchaseOrders.findMany({ with: { items: true } }),
    db.query.payrollRuns.findMany({ with: { entries: true } }),
    db.select().from(assets),
    db.query.catalogItems.findMany({ with: { movements: true } }),
  ]);

  const operatingId = accountRows.find((a) => a.code === "5100")?.id;
  if (!operatingId) throw new Error("Ledger is missing the operating expenses account (5100)");

  const signedRows = new Map<string, SignedRow>();
  const put = (code: string, name: string, type: AccountType, isSystem: boolean, signed: number, source: string) => {
    const prev = signedRows.get(code);
    signedRows.set(code, {
      code,
      name,
      type,
      isSystem,
      signed: (prev?.signed ?? 0) + signed,
      source: prev ? `${prev.source}, ${source}` : source,
    });
  };

  let bankSigned = 0;
  for (const b of bankRows) if (b.active) bankSigned += toNumber(b.openingBalance);

  let arSigned = 0;
  let salesSigned = 0;
  let vatSigned = 0;
  for (const inv of invRows) {
    if (inv.status === "cancelled") continue;
    if (!le(inv.issueDate, asOf)) continue;
    const t = totals(inv);
    const paid = inv.payments
      .filter((p) => le(p.date, asOf))
      .reduce((s, p) => s + toNumber(p.amount), 0);
    arSigned += Math.max(t.total - paid, 0);
    salesSigned -= t.total - t.tax; // revenue is the invoiced amount net of discounts (and VAT)
    vatSigned -= t.tax;
    bankSigned += paid;
  }

  for (const cn of cnRows) {
    if (cn.status === "cancelled") continue;
    if (!le(cn.issueDate, asOf)) continue;
    const t = totals(cn);
    arSigned -= t.total;
    salesSigned += t.total - t.tax; // credit notes reduce revenue at their net value
    vatSigned += t.tax;
  }

  const expenseSignedById = new Map<number, number>();
  for (const e of expenseRows) {
    if (!le(e.date, asOf)) continue;
    const amt = toNumber(e.amount);
    bankSigned -= amt;
    const accId = await resolveExpenseAccount(e.accountId, e.category, operatingId);
    expenseSignedById.set(accId, (expenseSignedById.get(accId) ?? 0) + amt);
  }

  let wagesSigned = 0;
  let payeSigned = 0;
  let uifSigned = 0;
  for (const run of runRows) {
    if (run.status !== "paid") continue;
    if (!le(run.payDate, asOf)) continue;
    for (const ent of run.entries) {
      const gross = toNumber(ent.salary) + toNumber(ent.additions);
      const tax = toNumber(ent.tax);
      const uif = toNumber(ent.uif);
      const other = toNumber(ent.otherDeductions);
      wagesSigned += gross;
      bankSigned -= gross - tax - uif - other; // net paid out of the bank
      payeSigned -= tax + other;
      uifSigned -= uif;
    }
  }

  let invSigned = 0;
  let apSigned = 0;
  for (const po of poRows) {
    if (po.status !== "received") continue;
    if (!le(po.issueDate, asOf)) continue;
    const t = totals(po);
    apSigned -= t.total; // goods received, not yet paid
    invSigned += t.subtotal; // received stock enters inventory at cost (excl. VAT)
    vatSigned += t.tax; // input VAT reclaimable
  }

  // Catalogue stock on hand at its catalogue price (an estimate — no cost data yet).
  for (const c of catRows) {
    const onHand = c.movements.reduce((s, m) => s + toNumber(m.deltaQty), 0);
    if (onHand > 0) invSigned += onHand * toNumber(c.unitPrice);
  }

  let faSigned = 0;
  for (const a of assetRows) {
    if (a.status === "disposed") continue;
    if (!le(a.purchaseDate, asOf)) continue;
    faSigned += toNumber(a.value);
  }

  put("1000", "Bank & cash", "asset", true, bankSigned, "payments, expenses, payroll");
  put("1100", "Trade receivables", "asset", true, arSigned, "invoices, credit notes");
  put("1200", "Inventory", "asset", true, invSigned, "purchase orders, stock movements");
  put("1300", "Property, plant & equipment", "asset", true, faSigned, "assets register");
  put("2000", "Trade payables", "liability", true, apSigned, "received purchase orders");
  put("2100", "VAT payable / receivable", "liability", true, vatSigned, "invoices, credit notes, purchase orders");
  put("2200", "Payroll tax & deductions payable", "liability", true, payeSigned, "paid payroll runs");
  put("2300", "UIF payable", "liability", true, uifSigned, "paid payroll runs");
  put("4000", "Sales & services", "income", true, salesSigned, "invoices, credit notes");
  put("5000", "Salaries & wages", "expense", true, wagesSigned, "paid payroll runs");

  const expenseAccounts = accountRows.filter((a) => a.type === "expense");
  const expenseNames = new Map(expenseAccounts.map((a) => [a.id, a.name]));
  for (const [accId, amt] of expenseSignedById) {
    const acc = expenseAccounts.find((a) => a.id === accId);
    const code = acc?.code ?? "5100";
    const name = expenseNames.get(accId) ?? "Operating expenses";
    put(code, name, "expense", acc?.isSystem ?? false, amt, "expenses");
  }

  const rows = Array.from(signedRows.values()).sort((a, b) => a.code.localeCompare(b.code));
  const totalSigned = rows.reduce((s, r) => s + r.signed, 0);
  const capital = -totalSigned; // balancing figure — absorbs opening balances
  put("3000", "Owner's capital", "equity", true, capital, "opening equity");

  const ordered = Array.from(signedRows.values()).sort((a, b) => a.code.localeCompare(b.code));
  const assetTotal = ordered.filter((r) => r.type === "asset").reduce((s, r) => s + r.signed, 0);
  const liabilities = ordered.filter((r) => r.type === "liability").reduce((s, r) => s + r.signed, 0);
  const income = ordered.filter((r) => r.type === "income").reduce((s, r) => s + r.signed, 0);
  const expenseTotal = ordered.filter((r) => r.type === "expense").reduce((s, r) => s + r.signed, 0);
  const netProfit = -(income + expenseTotal); // credit-positive
  const capitalRow = ordered.find((r) => r.code === "3000");

  return {
    rows: ordered,
    assets: assetTotal,
    liabilities,
    income,
    expenses: expenseTotal,
    netProfit,
    capital: capitalRow?.signed ?? capital,
  };
}

// ---------- Income statement (period) ----------

export type ProfitLine = {
  label: string;
  amount: number;
  code?: string;
  kind: "revenue" | "expense";
};

export type IncomeStatement = {
  from: string;
  to: string;
  revenue: ProfitLine[];
  expenses: ProfitLine[];
  revenueTotal: number;
  expenseTotal: number;
  netProfit: number;
};

export async function getIncomeStatement(from: string, to: string): Promise<IncomeStatement> {
  await ensureLedgerSeed();
  const [invRows, cnRows, expenseRows, runRows, accountRows] = await Promise.all([
    db.query.invoices.findMany({ with: { items: true } }),
    db.query.creditNotes.findMany({ with: { items: true } }),
    db.select().from(expenses),
    db.query.payrollRuns.findMany({ with: { entries: true } }),
    db.select().from(accounts),
  ]);

  const inRange = (d?: string | Date | null) => !!d && String(d).slice(0, 10) >= from && String(d).slice(0, 10) <= to;

  let revenue = 0;
  for (const inv of invRows) {
    if (inv.status === "cancelled") continue;
    if (!inRange(inv.issueDate)) continue;
    revenue += totals(inv).total - totals(inv).tax;
  }
  for (const cn of cnRows) {
    if (cn.status === "cancelled") continue;
    if (!inRange(cn.issueDate)) continue;
    revenue -= totals(cn).total - totals(cn).tax;
  }

  const operating = accountRows.find((a) => a.code === "5100");
  if (!operating) throw new Error("Ledger is missing the operating expenses account (5100)");
  const operatingId = operating.id;
  const expensesById = new Map<number, number>();
  for (const e of expenseRows) {
    if (!inRange(e.date)) continue;
    const accId = await resolveExpenseAccount(e.accountId, e.category, operatingId);
    expensesById.set(accId, (expensesById.get(accId) ?? 0) + toNumber(e.amount));
  }

  let wages = 0;
  for (const run of runRows) {
    if (run.status !== "paid") continue;
    if (!inRange(run.payDate)) continue;
    for (const ent of run.entries) wages += toNumber(ent.salary) + toNumber(ent.additions);
  }
  const wagesAccount = accountRows.find((a) => a.code === "5000");
  if (wagesAccount) expensesById.set(wagesAccount.id, (expensesById.get(wagesAccount.id) ?? 0) + wages);

  const revenueLines: ProfitLine[] = [{ label: "Sales & services", amount: revenue, code: "4000", kind: "revenue" }];
  const expenseLines: ProfitLine[] = [];
  const expenseAccountMap = new Map(accountRows.filter((a) => a.type === "expense").map((a) => [a.id, a]));
  for (const [accId, amt] of expensesById) {
    const acc = expenseAccountMap.get(accId);
    expenseLines.push({
      label: acc?.name ?? "Operating expenses",
      amount: amt,
      code: acc?.code,
      kind: "expense",
    });
  }
  expenseLines.sort((a, b) => (a.code ?? "999").localeCompare(b.code ?? "999"));

  const revenueTotal = revenueLines.reduce((s, l) => s + l.amount, 0);
  const expenseTotal = expenseLines.reduce((s, l) => s + l.amount, 0);
  return { from, to, revenue: revenueLines, expenses: expenseLines, revenueTotal, expenseTotal, netProfit: revenueTotal - expenseTotal };
}

// ---------- Balance sheet (as of) ----------

export type BsLine = { label: string; amount: number; code?: string };

export type BalanceSheet = {
  asOf: string;
  assets: BsLine[];
  liabilities: BsLine[];
  equity: BsLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
};

export async function getBalanceSheet(asOf: string): Promise<BalanceSheet> {
  const l = await computeLedger(asOf);
  const r = l.rows;

  const assets: BsLine[] = [];
  const liabilities: BsLine[] = [];

  for (const row of r) {
    if (row.type === "income" || row.type === "expense" || row.type === "equity") continue;
    if (row.signed === 0) continue;
    if (row.signed > 0) {
      const label =
        row.code === "1000" ? "Bank & cash"
        : row.code === "1100" ? "Trade receivables"
        : row.code === "2000" ? "Supplier prepayments"
        : row.code === "2100" ? "VAT receivable"
        : row.code === "2200" ? "Payroll tax receivable"
        : row.code === "2300" ? "UIF receivable"
        : row.name;
      assets.push({ label, amount: row.signed, code: row.code });
    } else {
      const label =
        row.code === "1000" ? "Bank overdraft"
        : row.code === "1100" ? "Customer credit balances"
        : row.code === "2000" ? "Trade payables"
        : row.code === "2100" ? "VAT payable"
        : row.code === "2200" ? "Payroll tax & deductions payable"
        : row.code === "2300" ? "UIF payable"
        : row.name;
      liabilities.push({ label, amount: -row.signed, code: row.code });
    }
  }

  // Equity is shown credit-positive: capital is the signed balancing figure
  // (debit-positive), so display it as −capital; retained earnings is netProfit.
  const capital = l.capital;
  const retained = l.netProfit;
  const equity: BsLine[] = [];
  if (capital !== 0) {
    equity.push({
      label: capital < 0 ? "Owner's capital" : "Drawings / capital deficit",
      amount: -capital,
      code: "3000",
    });
  }
  if (retained !== 0) {
    equity.push({
      label: retained > 0 ? "Retained earnings" : "Accumulated loss",
      amount: retained,
      code: "3100",
    });
  }

  const totalAssets = assets.reduce((s, x) => s + x.amount, 0);
  const totalLiabilities = liabilities.reduce((s, x) => s + x.amount, 0);
  const totalEquity = totalAssets - totalLiabilities; // balancing plug: A = L + E

  return { asOf, assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
}