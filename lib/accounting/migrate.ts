import { db } from "@/db";
import { accounts, assets, bankAccounts, creditNotes, expenses, invoices, payrollRuns, supplierBills } from "@/db/schema";
import { calcTotals, toNumber } from "@/lib/money";
import { postAccountingEvent } from "@/lib/accounting/posting";

const ACCOUNT_SEED = [
  ["1000", "Bank & cash", "asset", true, 10], ["1100", "Trade receivables", "asset", true, 20],
  ["1200", "Inventory", "asset", true, 30], ["1300", "Property, plant & equipment", "asset", true, 40],
  ["2000", "Trade payables", "liability", true, 50], ["2100", "VAT payable / receivable", "liability", true, 60],
  ["2200", "Payroll tax & deductions payable", "liability", true, 70], ["2300", "UIF payable", "liability", true, 80],
  ["3000", "Owner's capital", "equity", true, 90], ["3100", "Retained earnings", "equity", true, 100],
  ["4000", "Sales & services", "income", true, 110], ["5000", "Salaries & wages", "expense", true, 120],
  ["5100", "Operating expenses", "expense", true, 130], ["5200", "General & administrative", "expense", false, 140],
  ["5300", "Rent & utilities", "expense", false, 150], ["5400", "Fuel & transport", "expense", false, 160],
  ["5500", "Materials & supplies", "expense", false, 170], ["5600", "Marketing & advertising", "expense", false, 180],
  ["5700", "Insurance", "expense", false, 190],
] as const;

const CATEGORY_ACCOUNT_MAP: Array<[RegExp, string]> = [
  [/fuel|diesel|petrol|transport|travel|bakkie|vehicle/i, "5400"], [/rent|utilities|light|water|electr/i, "5300"],
  [/material|suppl|tools|stock|parts/i, "5500"], [/market|advert|promo|social/i, "5600"], [/insurance/i, "5700"],
  [/wage|salary|labour|labor|payroll/i, "5000"], [/admin|office|stationery|software|bank?charges/i, "5200"],
];

async function seedAccounts() {
  await db.insert(accounts).values(ACCOUNT_SEED.map(([code, name, type, isSystem, sortOrder]) => ({ code, name, type, isSystem, sortOrder }))).onConflictDoNothing({ target: accounts.code });
}

async function expenseAccountCode(accountId: number | null, category: string | null) {
  const rows = await db.select({ id: accounts.id, code: accounts.code }).from(accounts);
  if (accountId) {
    const selected = rows.find((row) => row.id === accountId);
    if (selected?.code) return selected.code;
  }
  for (const [pattern, code] of CATEGORY_ACCOUNT_MAP) if (category && pattern.test(category)) return code;
  return "5100";
}

function billTotals(bill: { taxRate: string; discount: string; items: { quantity: string; unitCost: string; vatTreatment?: string }[] }) {
  return calcTotals(bill.items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitCost, vatTreatment: item.vatTreatment })), bill.taxRate, bill.discount);
}

let migrated = false;
let migrationPromise: Promise<void> | null = null;

/** Backfills historical business transactions into the immutable journal once. */
export async function ensureAccountingJournal() {
  if (migrated) return;
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    await seedAccounts();
    const [bankRows, invoiceRows, creditRows, expenseRows, supplierBillRows, payrollRows, assetRows] = await Promise.all([
      db.select().from(bankAccounts), db.query.invoices.findMany({ with: { items: true, payments: true } }),
      db.query.creditNotes.findMany({ with: { items: true }}), db.select().from(expenses),
      db.query.supplierBills.findMany({ with: { items: true }}), db.query.payrollRuns.findMany({ with: { entries: true }}), db.select().from(assets),
    ]);

    for (const bank of bankRows) {
      const opening = toNumber(bank.openingBalance); if (opening === 0) continue;
      await postAccountingEvent({ date: new Date().toISOString().slice(0, 10), memo: `Opening balance — ${bank.name}`, reference: `bank-opening:${bank.id}`, enforcePeriod: false,
        lines: opening > 0 ? [{ code: "1000", debit: opening, memo: bank.name }, { code: "3000", credit: opening, memo: "Opening owner's capital" }] : [{ code: "3000", debit: Math.abs(opening), memo: "Opening capital deficit" }, { code: "1000", credit: Math.abs(opening), memo: bank.name }] });
    }

    for (const invoice of invoiceRows) {
      if (invoice.status === "draft" || invoice.status === "cancelled") continue;
      const t = calcTotals(invoice.items, invoice.taxRate, invoice.discount);
      const net = t.subtotal - t.discount;
      if (t.total <= 0) continue;
      await postAccountingEvent({ date: invoice.issueDate, memo: `Invoice ${invoice.number} issued`, reference: `invoice:${invoice.id}:issued`, enforcePeriod: false,
        lines: [{ code: "1100", debit: t.total, memo: "Trade receivable" }, ...(net > 0 ? [{ code: "4000", credit: net, memo: "Sales & services" }] : []), ...(t.tax > 0 ? [{ code: "2100", credit: t.tax, memo: "Output VAT" }] : [])] });
      for (const payment of invoice.payments) if (toNumber(payment.amount) > 0) await postAccountingEvent({ date: payment.date, memo: `Payment received for invoice ${invoice.number}`, reference: `payment:${payment.id}:received`, enforcePeriod: false, lines: [{ code: "1000", debit: toNumber(payment.amount), memo: "Bank & cash" }, { code: "1100", credit: toNumber(payment.amount), memo: "Trade receivable" }] });
    }
    for (const note of creditRows) {
      if (note.status === "draft" || note.status === "cancelled") continue;
      const t = calcTotals(note.items, note.taxRate, note.discount);
      const net = t.subtotal - t.discount;
      if (t.total <= 0) continue;
      await postAccountingEvent({ date: note.issueDate, memo: `Credit note ${note.number} issued`, reference: `credit-note:${note.id}:issued`, enforcePeriod: false,
        lines: [...(net > 0 ? [{ code: "4000", debit: net, memo: "Sales reversal" }] : []), ...(t.tax > 0 ? [{ code: "2100", debit: t.tax, memo: "Output VAT reversal" }] : []), { code: "1100", credit: t.total, memo: "Trade receivable" }] });
    }
    for (const expense of expenseRows) {
      const amount = toNumber(expense.amount);
      if (expense.status !== "approved" || amount <= 0) continue;
      await postAccountingEvent({ date: expense.date, memo: `Expense ${expense.id} approved`, reference: `expense:${expense.id}:approved`, enforcePeriod: false,
        lines: [{ code: await expenseAccountCode(expense.accountId, expense.category), debit: amount, memo: "Expense" }, { code: "1000", credit: amount, memo: "Bank & cash" }] });
    }
    for (const bill of supplierBillRows) {
      if (bill.status !== "approved") continue;
      const t = billTotals(bill);
      if (t.total <= 0) continue;
      const inventoryAmount = Math.min(t.subtotal - t.discount, bill.items.filter((item) => item.catalogItemId != null).reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitCost), 0));
      const expenseAmount = Math.max(t.subtotal - t.discount - inventoryAmount, 0);
      await postAccountingEvent({ date: bill.billDate, memo: `Supplier bill ${bill.number} approved`, reference: `supplier-bill:${bill.id}:approved`, enforcePeriod: false,
        lines: [
          ...(inventoryAmount > 0 ? [{ code: "1200", debit: inventoryAmount, memo: "Inventory received" }] : []),
          ...(expenseAmount > 0 ? [{ code: "5100", debit: expenseAmount, memo: "Supplier expense" }] : []),
          ...(t.tax > 0 ? [{ code: "2100", debit: t.tax, memo: "Input VAT" }] : []),
          { code: "2000", credit: t.total, memo: "Trade payable" },
        ] });
      if (bill.paid && t.total > 0) await postAccountingEvent({ date: bill.paidDate ?? bill.billDate, memo: `Payment of supplier bill ${bill.number}`, reference: `supplier-bill:${bill.id}:paid`, enforcePeriod: false, lines: [{ code: "2000", debit: t.total, memo: "Trade payable" }, { code: "1000", credit: t.total, memo: "Bank & cash" }] });
    }
    for (const run of payrollRows) {
      if (run.status !== "paid") continue;
      const t = run.entries.reduce((sum, entry) => ({ gross: sum.gross + toNumber(entry.salary) + toNumber(entry.additions), tax: sum.tax + toNumber(entry.tax), uif: sum.uif + toNumber(entry.uif), other: sum.other + toNumber(entry.otherDeductions) }), { gross: 0, tax: 0, uif: 0, other: 0 });
      const net = t.gross - t.tax - t.uif - t.other;
      if (t.gross <= 0 || net < 0) continue;
      await postAccountingEvent({ date: run.payDate, memo: `Payroll run ${run.id} paid`, reference: `payroll:${run.id}:paid`, enforcePeriod: false,
        lines: [{ code: "5000", debit: t.gross, memo: "Salaries & wages" }, ...(t.tax + t.other > 0 ? [{ code: "2200", credit: t.tax + t.other, memo: "PAYE / deductions payable" }] : []), ...(t.uif > 0 ? [{ code: "2300", credit: t.uif, memo: "UIF payable" }] : []), ...(net > 0 ? [{ code: "1000", credit: net, memo: "Net payroll" }] : [])] });
    }
    for (const asset of assetRows) {
      const value = toNumber(asset.value);
      if (asset.status === "disposed" || !asset.purchaseDate || value <= 0) continue;
      await postAccountingEvent({ date: asset.purchaseDate, memo: `Asset ${asset.name} acquired`, reference: `asset:${asset.id}:acquired`, enforcePeriod: false,
        lines: [{ code: "1300", debit: value, memo: "Property, plant & equipment" }, { code: "1000", credit: value, memo: "Bank & cash" }] });
    }
    migrated = true;
  })();
  try { await migrationPromise; } finally { migrationPromise = null; }
}
