"use server";

import { db } from "@/db";
import { bankAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { importBankTransactions, reconcileBankTransaction, setAccountingPeriodStatus, unreconcileBankTransaction } from "@/lib/accounting/control";

export async function setPeriodStatus(id: number, status: "open" | "closed") {
  await setAccountingPeriodStatus(id, status);
  revalidatePath("/accounting/control");
}

export async function importBankCsv(formData: FormData) {
  const bankAccountId = Number(formData.get("bankAccountId"));
  if (!bankAccountId) throw new Error("Choose a bank account");
  const csv = String(formData.get("csv") ?? "").trim();
  if (!csv) throw new Error("Paste bank CSV data");
  const rows = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 5000);
  const parsed = rows.map((line) => {
    const [date, description, reference, amountRaw, directionRaw] = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const amount = Number(amountRaw);
    const direction = directionRaw?.toLowerCase() === "out" || amount < 0 ? "out" : "in";
    return { bankAccountId, date, description, reference: reference || null, amount: Math.abs(amount), direction: direction as "in" | "out" };
  }).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.description && Number.isFinite(row.amount));
  if (!parsed.length) throw new Error("No valid rows. Expected date,description,reference,amount,in|out");
  await importBankTransactions(parsed);
  revalidatePath("/accounting/control");
}

export async function reconcileTransaction(id: number, journalEntryId: number) {
  if (!journalEntryId) throw new Error("Journal entry is required");
  await reconcileBankTransaction(id, journalEntryId);
  revalidatePath("/accounting/control");
}

export async function unreconcileTransaction(id: number) {
  await unreconcileBankTransaction(id);
  revalidatePath("/accounting/control");
}

export async function createBankAccount(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Bank account name is required");
  await db.insert(bankAccounts).values({ name, bankName: String(formData.get("bankName") ?? "") || null, accountNumber: String(formData.get("accountNumber") ?? "") || null, openingBalance: String(formData.get("openingBalance") ?? "0"), active: true, isDefault: false });
  revalidatePath("/accounting/control");
}
