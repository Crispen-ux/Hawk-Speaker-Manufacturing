"use server";

import { db } from "@/db";
import { accounts, journalEntries, journalLines } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { flashUrl } from "@/lib/flash";
import { nextJournalNumber } from "@/lib/numbering";

type LineInput = { accountId: number; debit: number; credit: number; memo?: string | null };

function toNum(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

function parseLines(raw: string): LineInput[] {
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    throw new Error("Invalid line data");
  }
  if (!Array.isArray(arr)) throw new Error("Line data must be an array");
  return arr
    .map((l) => ({
      accountId: Number((l as { accountId?: unknown }).accountId) || 0,
      debit: toNum((l as { debit?: unknown }).debit),
      credit: toNum((l as { credit?: unknown }).credit),
      memo: (l as { memo?: unknown }).memo ? String((l as { memo?: unknown }).memo).trim() : null,
    }))
    .filter((l) => l.accountId > 0 && (l.debit > 0 || l.credit > 0));
}

async function validateLines(kind: string, lines: LineInput[]) {
  if (lines.length < 2) throw new Error("A journal entry needs at least two lines");
  for (const l of lines) {
    if (l.debit < 0 || l.credit < 0) throw new Error("Amounts cannot be negative");
    if (l.debit > 0 && l.credit > 0) {
      throw new Error("A line can't have both a debit and a credit");
    }
  }
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `Entry doesn't balance — debits ${totalDebit.toFixed(2)} vs credits ${totalCredit.toFixed(2)}`
    );
  }
  if (totalDebit <= 0) throw new Error("Entry total must be greater than zero");

  if (kind === "opening") {
    const accs = await db
      .select()
      .from(accounts)
      .where(inArray(accounts.id, lines.map((l) => l.accountId)));
    const bad = accs.filter((a) => a.type !== "asset" && a.type !== "liability" && a.type !== "equity");
    if (bad.length > 0) {
      throw new Error(
        `Opening balances can only use asset, liability or equity accounts (${bad
          .map((b) => b.code)
          .join(", ")})`
      );
    }
  }
}

function lineValues(lines: LineInput[], journalEntryId: number) {
  return lines.map((l) => ({
    journalEntryId,
    accountId: l.accountId,
    debit: l.debit.toFixed(2),
    credit: l.credit.toFixed(2),
    memo: l.memo,
  }));
}

function revalidateAccounting() {
  for (const p of [
    "/accounting/journal",
    "/accounting/trial-balance",
    "/accounting/income-statement",
    "/accounting/balance-sheet",
  ]) {
    revalidatePath(p);
  }
}

export async function createJournalEntry(formData: FormData) {
  const kind = String(formData.get("kind") ?? "manual") === "opening" ? "opening" : "manual";
  const memo = String(formData.get("memo") ?? "").trim();
  if (!memo) throw new Error("Memo is required");
  const date = String(formData.get("date") ?? "");
  if (!date) throw new Error("Date is required");
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const lines = parseLines(String(formData.get("lines") ?? "[]"));
  await validateLines(kind, lines);

  const number = await nextJournalNumber();
  const entry = await db.transaction(async (tx) => {
    const [je] = await tx
      .insert(journalEntries)
      .values({ number, date, kind, memo, reference })
      .returning({ id: journalEntries.id });
    await tx.insert(journalLines).values(lineValues(lines, je.id));
    return je;
  });

  void logAudit({ documentKind: "journalEntry", documentId: entry.id, documentNumber: number, action: "created", detail: memo });
  revalidateAccounting();
  redirect(flashUrl(`/accounting/journal/${entry.id}`, "Journal entry created"));
}

export async function updateJournalEntry(id: number, formData: FormData) {
  const kind = String(formData.get("kind") ?? "manual") === "opening" ? "opening" : "manual";
  const memo = String(formData.get("memo") ?? "").trim();
  if (!memo) throw new Error("Memo is required");
  const date = String(formData.get("date") ?? "");
  if (!date) throw new Error("Date is required");
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const lines = parseLines(String(formData.get("lines") ?? "[]"));
  await validateLines(kind, lines);

  await db.transaction(async (tx) => {
    await tx.update(journalEntries).set({ date, kind, memo, reference }).where(eq(journalEntries.id, id));
    await tx.delete(journalLines).where(eq(journalLines.journalEntryId, id));
    await tx.insert(journalLines).values(lineValues(lines, id));
  });

  void logAudit({ documentKind: "journalEntry", documentId: id, documentNumber: undefined, action: "updated", detail: memo });
  revalidateAccounting();
  redirect(flashUrl(`/accounting/journal/${id}`, "Journal entry updated"));
}

export async function deleteJournalEntry(id: number) {
  const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.id, id));
  await db.delete(journalEntries).where(eq(journalEntries.id, id));
  if (entry) void logAudit({ documentKind: "journalEntry", documentId: id, documentNumber: entry.number, action: "deleted", detail: entry.memo });
  revalidateAccounting();
  redirect(flashUrl("/accounting/journal", "Journal entry deleted"));
}