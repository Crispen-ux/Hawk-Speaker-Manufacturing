"use server";

import { db } from "@/db";
import { accounts, bankAccounts, journalEntries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { importBankTransactions, reconcileBankTransaction, setAccountingPeriodStatus, unreconcileBankTransaction } from "@/lib/accounting/control";

const ACCOUNT_TYPES = new Set(["asset", "liability", "equity", "income", "expense"]);

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
  const openingBalance = Number(formData.get("openingBalance") ?? 0);
  if (!Number.isFinite(openingBalance)) throw new Error("Opening balance must be a valid number");
  await db.insert(bankAccounts).values({ name, bankName: String(formData.get("bankName") ?? "") || null, accountNumber: String(formData.get("accountNumber") ?? "") || null, openingBalance: openingBalance.toFixed(2), active: true, isDefault: false });
  revalidatePath("/accounting/control");
}

export async function createAccount(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!/^\d{3,16}$/.test(code)) throw new Error("Account code must contain 3 to 16 digits");
  if (!name) throw new Error("Account name is required");
  if (!ACCOUNT_TYPES.has(type)) throw new Error("Invalid account type");
  const [existing] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, code)).limit(1);
  if (existing) throw new Error(`Account ${code} already exists`);
  await db.insert(accounts).values({ code, name, type: type as "asset" | "liability" | "equity" | "income" | "expense", description, isSystem: false, active: true, sortOrder: Number(code) });
  revalidatePath("/accounting");
  revalidatePath("/accounting/control");
  revalidatePath("/accounting/chart-of-accounts");
}

export async function toggleAccount(id: number, active: boolean) {
  const [account] = await db.select({ isSystem: accounts.isSystem }).from(accounts).where(eq(accounts.id, id)).limit(1);
  if (!account) throw new Error("Account not found");
  if (account.isSystem) throw new Error("System accounts cannot be deactivated");
  if (!active) {
    const [used] = await db.select({ id: journalEntries.id }).from(journalEntries).innerJoin(accounts, eq(accounts.id, id)).limit(1);
    void used;
  }
  await db.update(accounts).set({ active }).where(eq(accounts.id, id));
  revalidatePath("/accounting/chart-of-accounts");
  revalidatePath("/accounting/control");
}
