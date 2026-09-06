import { db } from "@/db";
import { accounts, assets, bankAccounts, creditNotes, expenses, invoices, payrollRuns, supplierBills } from "@/db/schema";
import { calcTotals, toNumber } from "@/lib/money";
import {
  postAccountingEvent,
  postAssetAcquired,
  postCreditNoteIssued,
  postExpenseApproved,
  postInvoiceIssued,
  postPayrollPaid,
  postPaymentReceived,
  postSupplierBillApproved,
  postSupplierPayment,
} from "@/lib/accounting/posting";

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

function billTotals(bill: { taxRate: string; discount: string; items: { quantity: string; unitCost: string }[] }) {
  return calcTotals(bill.items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitCost })), bill.taxRate, bill.discount);
}

let migrated = false;

export async function ensureAccountingJournal() {
  if (migrated) return;
  await seedAccounts();
  const [bankRows, invoiceRows, creditRows, expenseRows, supplierBillRows, payrollRows, assetRows] = await Promise.all([
    db.select().from(bankAccounts), db.query.invoices.findMany({ with: { items: true, payments: true }}),
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
    await postInvoiceIssued({ invoiceId: invoice.id, invoiceNumber: invoice.number, date: invoice.issueDate, subtotal: t.subtotal, tax: t.tax });
    for (const payment of invoice.payments) await postPaymentReceived({ paymentId: payment.id, invoiceNumber: invoice.number, date: payment.date, amount: toNumber(payment.amount) });
  }
  for (const note of creditRows) {
    if (note.status === "draft" || note.status === "cancelled") continue;
    const t = calcTotals(note.items, note.taxRate, note.discount);
    await postCreditNoteIssued({ creditNoteId: note.id, number: note.number, date: note.issueDate, subtotal: t.subtotal, tax: t.tax });
  }
  for (const expense of expenseRows) {
    if (expense.status !== "approved") continue;
    await postExpenseApproved({ expenseId: expense.id, date: expense.date, amount: toNumber(expense.amount), accountCode: await expenseAccountCode(expense.accountId, expense.category) });
  }
  for (const bill of supplierBillRows) {
    if (bill.status !== "approved") continue;
    const t = billTotals(bill);
    const inventoryAmount = bill.items.filter((item) => item.catalogItemId != null).reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitCost), 0);
    await postSupplierBillApproved({ supplierBillId: bill.id, number: bill.number, date: bill.billDate, subtotal: t.subtotal, tax: t.tax, inventoryAmount, expenseAmount: Math.max(t.subtotal - inventoryAmount, 0) });
    if (bill.paid) await postSupplierPayment({ supplierBillId: bill.id, number: bill.number, date: bill.paidDate ?? bill.billDate, amount: t.total });
  }
  for (const run of payrollRows) {
    if (run.status !== "paid") continue;
    const t = run.entries.reduce((sum, entry) => ({ gross: sum.gross + toNumber(entry.salary) + toNumber(entry.additions), tax: sum.tax + toNumber(entry.tax), uif: sum.uif + toNumber(entry.uif), other: sum.other + toNumber(entry.otherDeductions) }), { gross: 0, tax: 0, uif: 0, other: 0 });
    await postPayrollPaid({ runId: run.id, date: run.payDate, ...t });
  }
  for (const asset of assetRows) {
    if (asset.status === "disposed" || !asset.purchaseDate) continue;
    await postAssetAcquired({ assetId: asset.id, date: asset.purchaseDate, value: toNumber(asset.value), name: asset.name });
  }
  migrated = true;
}
