import { db } from "@/db";
import { accounts, journalEntries, journalLines } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { nextJournalNumber } from "@/lib/numbering";
import { assertAccountingPeriodOpen, ensureAccountingInfrastructure } from "@/lib/accounting/control";
import { ensureLedgerSeed } from "@/lib/ledger";

export type PostingLine = {
  code: string;
  debit?: number;
  credit?: number;
  memo?: string | null;
};

const EPSILON = 0.005;

function money(value: number) {
  if (!Number.isFinite(value)) throw new Error("Accounting amount must be a finite number");
  return Number(value.toFixed(2));
}

async function accountMap() {
  const rows = await db.select().from(accounts);
  return new Map(rows.map((row) => [row.code, row]));
}

function validatePosting(lines: PostingLine[]) {
  if (lines.length < 2) throw new Error("An accounting posting needs at least two lines");
  const normalised = lines.map((line) => ({
    ...line,
    debit: money(line.debit ?? 0),
    credit: money(line.credit ?? 0),
  }));
  for (const line of normalised) {
    if (line.debit < 0 || line.credit < 0) throw new Error("Accounting amounts cannot be negative");
    if (line.debit > 0 && line.credit > 0) throw new Error("A posting line cannot contain both debit and credit");
    if (line.debit === 0 && line.credit === 0) throw new Error("Accounting lines cannot both be zero");
  }
  const debit = money(normalised.reduce((sum, line) => sum + line.debit, 0));
  const credit = money(normalised.reduce((sum, line) => sum + line.credit, 0));
  if (debit <= 0) throw new Error("Accounting posting must be greater than zero");
  if (Math.abs(debit - credit) > EPSILON) {
    throw new Error(`Accounting posting is not balanced: Dr ${debit.toFixed(2)} / Cr ${credit.toFixed(2)}`);
  }
  return normalised;
}

/** Post one immutable accounting event. `reference` is the idempotency key. */
export async function postAccountingEvent(input: {
  date: string;
  memo: string;
  reference: string;
  lines: PostingLine[];
  enforcePeriod?: boolean;
}) {
  await ensureAccountingInfrastructure();
  await ensureLedgerSeed();
  const lines = validatePosting(input.lines);
  if (input.enforcePeriod !== false) await assertAccountingPeriodOpen(input.date);

  const existing = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(eq(journalEntries.reference, input.reference))
    .limit(1);
  if (existing.length) return existing[0].id;

  const byCode = await accountMap();
  const resolved = lines.map((line) => {
    const account = byCode.get(line.code);
    if (!account) throw new Error(`Accounting account ${line.code} does not exist`);
    return {
      accountId: account.id,
      debit: line.debit.toFixed(2),
      credit: line.credit.toFixed(2),
      memo: line.memo ?? null,
    };
  });

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.reference}))`);
    const race = await tx
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(eq(journalEntries.reference, input.reference))
      .limit(1);
    if (race.length) return race[0].id;

    const number = await nextJournalNumber();
    const [entry] = await tx
      .insert(journalEntries)
      .values({
        number,
        date: input.date,
        kind: "manual",
        memo: input.memo,
        reference: input.reference,
      })
      .returning({ id: journalEntries.id });
    await tx.insert(journalLines).values(resolved.map((line) => ({ ...line, journalEntryId: entry.id })));
    return entry.id;
  });
}

export async function postInvoiceIssued(input: { invoiceId: number; invoiceNumber: string; date: string; subtotal: number; tax: number }) {
  const total = money(input.subtotal + input.tax);
  if (total <= 0) return null;
  return postAccountingEvent({
    date: input.date,
    memo: `Invoice ${input.invoiceNumber} issued`,
    reference: `invoice:${input.invoiceId}:issued`,
    lines: [
      { code: "1100", debit: total, memo: "Trade receivable" },
      ...(input.subtotal > 0 ? [{ code: "4000", credit: input.subtotal, memo: "Sales & services" }] : []),
      ...(input.tax > 0 ? [{ code: "2100", credit: input.tax, memo: "Output VAT" }] : []),
    ],
  });
}

export async function postPaymentReceived(input: { paymentId: number; invoiceNumber: string; date: string; amount: number }) {
  if (input.amount <= 0) throw new Error("Payment must be greater than zero");
  return postAccountingEvent({
    date: input.date,
    memo: `Payment received for invoice ${input.invoiceNumber}`,
    reference: `payment:${input.paymentId}:received`,
    lines: [
      { code: "1000", debit: input.amount, memo: "Bank & cash" },
      { code: "1100", credit: input.amount, memo: "Trade receivable" },
    ],
  });
}

export async function postCreditNoteIssued(input: { creditNoteId: number; number: string; date: string; subtotal: number; tax: number }) {
  const total = money(input.subtotal + input.tax);
  if (total <= 0) return null;
  return postAccountingEvent({
    date: input.date,
    memo: `Credit note ${input.number} issued`,
    reference: `credit-note:${input.creditNoteId}:issued`,
    lines: [
      ...(input.subtotal > 0 ? [{ code: "4000", debit: input.subtotal, memo: "Sales reversal" }] : []),
      ...(input.tax > 0 ? [{ code: "2100", debit: input.tax, memo: "Output VAT reversal" }] : []),
      { code: "1100", credit: total, memo: "Trade receivable" },
    ],
  });
}

export async function postExpenseApproved(input: { expenseId: number; date: string; amount: number; accountCode: string; inputVat?: number }) {
  const amount = money(input.amount);
  const inputVat = money(input.inputVat ?? 0);
  const net = money(amount - inputVat);
  if (amount <= 0) throw new Error("Expense must be greater than zero");
  if (inputVat < 0 || inputVat > amount) throw new Error("Input VAT must be between zero and the expense total");
  return postAccountingEvent({
    date: input.date,
    memo: `Expense ${input.expenseId} approved`,
    reference: `expense:${input.expenseId}:approved`,
    lines: [
      ...(net > 0 ? [{ code: input.accountCode, debit: net, memo: "Expense" }] : []),
      ...(inputVat > 0 ? [{ code: "2100", debit: inputVat, memo: "Input VAT" }] : []),
      { code: "1000", credit: amount, memo: "Bank & cash" },
    ],
  });
}

export async function postSupplierBillApproved(input: {
  supplierBillId: number;
  number: string;
  date: string;
  subtotal: number;
  tax: number;
  inventoryAmount: number;
  expenseAmount: number;
}) {
  const total = money(input.subtotal + input.tax);
  const inventory = money(input.inventoryAmount);
  const expense = money(input.expenseAmount);
  const lines: PostingLine[] = [];
  if (inventory > 0) lines.push({ code: "1200", debit: inventory, memo: "Inventory received" });
  if (expense > 0) lines.push({ code: "5100", debit: expense, memo: "Supplier expense" });
  if (input.tax > 0) lines.push({ code: "2100", debit: input.tax, memo: "Input VAT" });
  lines.push({ code: "2000", credit: total, memo: "Trade payable" });
  return postAccountingEvent({
    date: input.date,
    memo: `Supplier bill ${input.number} approved`,
    reference: `supplier-bill:${input.supplierBillId}:approved`,
    lines,
  });
}

export async function postSupplierPayment(input: { supplierBillId: number; number: string; date: string; amount: number }) {
  return postAccountingEvent({
    date: input.date,
    memo: `Payment of supplier bill ${input.number}`,
    reference: `supplier-bill:${input.supplierBillId}:paid`,
    lines: [
      { code: "2000", debit: input.amount, memo: "Trade payable" },
      { code: "1000", credit: input.amount, memo: "Bank & cash" },
    ],
  });
}

export async function postPayrollPaid(input: { runId: number; date: string; gross: number; tax: number; uif: number; other: number }) {
  const net = money(input.gross - input.tax - input.uif - input.other);
  if (input.gross <= 0 || input.tax < 0 || input.uif < 0 || input.other < 0 || net < 0) throw new Error("Invalid payroll amounts");
  const lines: PostingLine[] = [
    { code: "5000", debit: input.gross, memo: "Salaries & wages" },
    ...(input.tax + input.other > 0 ? [{ code: "2200", credit: input.tax + input.other, memo: "PAYE / deductions payable" }] : []),
    ...(input.uif > 0 ? [{ code: "2300", credit: input.uif, memo: "UIF payable" }] : []),
    ...(net > 0 ? [{ code: "1000", credit: net, memo: "Net payroll" }] : []),
  ];
  return postAccountingEvent({
    date: input.date,
    memo: `Payroll run ${input.runId} paid`,
    reference: `payroll:${input.runId}:paid`,
    lines,
  });
}

export async function postAssetAcquired(input: { assetId: number; date: string; value: number; name: string }) {
  if (input.value <= 0) return null;
  return postAccountingEvent({
    date: input.date,
    memo: `Asset ${input.name} acquired`,
    reference: `asset:${input.assetId}:acquired`,
    lines: [
      { code: "1300", debit: input.value, memo: "Property, plant & equipment" },
      { code: "1000", credit: input.value, memo: "Bank & cash" },
    ],
  });
}
