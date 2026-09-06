import { db } from "@/db";
import { accounts, journalEntries, journalLines } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { nextJournalNumber } from "@/lib/numbering";

export type PostingLine = {
  code: string;
  debit?: number;
  credit?: number;
  memo?: string | null;
};

const EPSILON = 0.005;

function money(value: number) {
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
  }

  const debit = money(normalised.reduce((sum, line) => sum + line.debit, 0));
  const credit = money(normalised.reduce((sum, line) => sum + line.credit, 0));
  if (debit <= 0) throw new Error("Accounting posting must be greater than zero");
  if (Math.abs(debit - credit) > EPSILON) {
    throw new Error(`Accounting posting is not balanced: Dr ${debit.toFixed(2)} / Cr ${credit.toFixed(2)}`);
  }
  return normalised;
}

/**
 * Post one immutable accounting event. `reference` is an idempotency key,
 * e.g. `invoice:123:issued` or `payment:456:received`.
 */
export async function postAccountingEvent(input: {
  date: string;
  memo: string;
  reference: string;
  lines: PostingLine[];
}) {
  const lines = validatePosting(input.lines);
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
      journalEntryId: 0,
      accountId: account.id,
      debit: line.debit.toFixed(2),
      credit: line.credit.toFixed(2),
      memo: line.memo ?? null,
    };
  });

  const number = await nextJournalNumber();
  return db.transaction(async (tx) => {
    const race = await tx
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(eq(journalEntries.reference, input.reference))
      .limit(1);
    if (race.length) return race[0].id;

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

    await tx.insert(journalLines).values(
      resolved.map((line) => ({ ...line, journalEntryId: entry.id }))
    );

    return entry.id;
  });
}

export async function postInvoiceIssued(input: {
  invoiceId: number;
  invoiceNumber: string;
  date: string;
  subtotal: number;
  tax: number;
}) {
  const total = money(input.subtotal + input.tax);
  if (total <= 0) return null;
  return postAccountingEvent({
    date: input.date,
    memo: `Invoice ${input.invoiceNumber} issued`,
    reference: `invoice:${input.invoiceId}:issued`,
    lines: [
      { code: "1100", debit: total, memo: "Trade receivable" },
      { code: "4000", credit: input.subtotal, memo: "Sales & services" },
      ...(input.tax > 0 ? [{ code: "2100", credit: input.tax, memo: "Output VAT" }] : []),
    ],
  });
}

export async function postPaymentReceived(input: {
  paymentId: number;
  invoiceNumber: string;
  date: string;
  amount: number;
}) {
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

export async function postCreditNoteIssued(input: {
  creditNoteId: number;
  number: string;
  date: string;
  subtotal: number;
  tax: number;
}) {
  const total = money(input.subtotal + input.tax);
  if (total <= 0) return null;
  return postAccountingEvent({
    date: input.date,
    memo: `Credit note ${input.number} issued`,
    reference: `credit-note:${input.creditNoteId}:issued`,
    lines: [
      { code: "4000", debit: input.subtotal, memo: "Sales reversal" },
      ...(input.tax > 0 ? [{ code: "2100", debit: input.tax, memo: "Output VAT reversal" }] : []),
      { code: "1100", credit: total, memo: "Trade receivable" },
    ],
  });
}
