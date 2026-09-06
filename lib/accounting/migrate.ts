import { db } from "@/db";
import { accounts, assets, bankAccounts, creditNotes, expenses, invoices, payrollRuns, supplierBills } from "@/db/schema";
import { calcTotals, toNumber } from "@/lib/money";
import { ensureLedgerSeed } from "@/lib/ledger";
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

const CATEGORY_ACCOUNT_MAP: Array<[RegExp, string]> = [
  [/fuel|diesel|petrol|transport|travel|bakkie|vehicle/i, "5400"],
  [/rent|utilities|light|water|electr/i, "5300"],
  [/material|suppl|tools|stock|parts/i, "5500"],
  [/market|advert|promo|social/i, "5600"],
  [/insurance/i, "5700"],
  [/wage|salary|labour|labor|payroll/i, "5000"],
  [/admin|office|stationery|software|bank?charges/i, "5200"],
];

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
  const items = bill.items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitCost }));
  return calcTotals(items, bill.taxRate, bill.discount);
}

let migrated = false;

/**
 * Backfills the journal from legacy sub-ledgers exactly once per event. This
 * lets the application switch to a true GL without double-counting historical
 * invoices, payments, expenses, payroll, supplier bills or assets.
 */
export async function ensureAccountingJournal() {
  if (migrated) return;
  await ensureLedgerSeed();

  const [bankRows, invoiceRows, creditRows, expenseRows, supplierBillRows, payrollRows, assetRows] = await Promise.all([
    db.select().from(bankAccounts),
    db.query.invoices.findMany({ with: { items: true, payments: true } }),
    db.query.creditNotes.findMany({ with: { items: true } }),
    db.select().from(expenses),
    db.query.supplierBills.findMany({ with: { items: true } }),
    db.query.payrollRuns.findMany({ with: { entries: true } }),
    db.select().from(assets),
  ]);

  // Opening bank balances become proper opening entries instead of silently
  // sitting outside the general ledger.
  for (const bank of bankRows) {
    const opening = toNumber(bank.openingBalance);
    if (opening === 0) continue;
    await postAccountingEvent({
      date: new Date().toISOString().slice(0, 10),
      memo: `Opening balance — ${bank.name}`,
      reference: `bank-opening:${bank.id}`,
      enforcePeriod: false,
      lines: opening > 0
        ? [
            { code: "1000", debit: opening, memo: bank.name },
            { code: "3000", credit: opening, memo: "Opening owner's capital" },
          ]
        : [
            { code: "3000", debit: Math.abs(opening), memo: "Opening capital deficit" },
            { code: "1000", credit: Math.abs(opening), memo: bank.name },
          ],
    });
  }

  for (const invoice of invoiceRows) {
    if (invoice.status === "draft" || invoice.status === "cancelled") continue;
    const totals = calcTotals(invoice.items, invoice.taxRate, invoice.discount);
    await postInvoiceIssued({
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      date: invoice.issueDate,
      subtotal: totals.subtotal,
      tax: totals.tax,
    });
    for (const payment of invoice.payments) {
      await postPaymentReceived({
        paymentId: payment.id,
        invoiceNumber: invoice.number,
        date: payment.date,
        amount: toNumber(payment.amount),
      });
    }
  }

  for (const note of creditRows) {
    if (note.status === "draft" || note.status === "cancelled") continue;
    const totals = calcTotals(note.items, note.taxRate, note.discount);
    await postCreditNoteIssued({
      creditNoteId: note.id,
      number: note.number,
      date: note.issueDate,
      subtotal: totals.subtotal,
      tax: totals.tax,
    });
  }

  for (const expense of expenseRows) {
    if (expense.status !== "approved") continue;
    await postExpenseApproved({
      expenseId: expense.id,
      date: expense.date,
      amount: toNumber(expense.amount),
      accountCode: await expenseAccountCode(expense.accountId, expense.category),
    });
  }

  for (const bill of supplierBillRows) {
    if (bill.status !== "approved") continue;
    const totals = billTotals(bill);
    const inventoryAmount = bill.items
      .filter((item) => item.catalogItemId != null)
      .reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitCost), 0);
    await postSupplierBillApproved({
      supplierBillId: bill.id,
      number: bill.number,
      date: bill.billDate,
      subtotal: totals.subtotal,
      tax: totals.tax,
      inventoryAmount,
      expenseAmount: Math.max(totals.subtotal - inventoryAmount, 0),
    });
    if (bill.paid) {
      await postSupplierPayment({
        supplierBillId: bill.id,
        number: bill.number,
        date: bill.paidDate ?? bill.billDate,
        amount: totals.total,
      });
    }
  }

  for (const run of payrollRows) {
    if (run.status !== "paid") continue;
    const totals = run.entries.reduce(
      (sum, entry) => ({
        gross: sum.gross + toNumber(entry.salary) + toNumber(entry.additions),
        tax: sum.tax + toNumber(entry.tax),
        uif: sum.uif + toNumber(entry.uif),
        other: sum.other + toNumber(entry.otherDeductions),
      }),
      { gross: 0, tax: 0, uif: 0, other: 0 }
    );
    await postPayrollPaid({ runId: run.id, date: run.payDate, ...totals });
  }

  for (const asset of assetRows) {
    if (asset.status === "disposed" || !asset.purchaseDate) continue;
    await postAssetAcquired({
      assetId: asset.id,
      date: asset.purchaseDate,
      value: toNumber(asset.value),
      name: asset.name,
    });
  }

  migrated = true;
}
