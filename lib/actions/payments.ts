"use server";

import { recordInvoicePayment } from "@/lib/actions/invoices";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flashUrl } from "@/lib/flash";

export async function recordStandalonePayment(formData: FormData) {
  const invoiceId = Number(formData.get("invoiceId"));
  if (!invoiceId) throw new Error("Choose an invoice");

  await recordInvoicePayment(invoiceId, {
    amount: String(formData.get("amount") ?? "0"),
    date: String(formData.get("date")),
    method: String(formData.get("method") ?? "") || null,
    note: String(formData.get("note") ?? "") || null,
  });

  revalidatePath("/payments");
  redirect(flashUrl(`/payments` , "Payment recorded"));
}