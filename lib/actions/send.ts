"use server";

import { sendInvoiceByEmail, sendQuotationByEmail, sendPurchaseOrderByEmail, sendJobCardByEmail, sendDeliveryNoteByEmail } from "@/lib/send";
import { revalidatePath } from "next/cache";

export type SendState = { status: "idle" | "success" | "error"; message?: string };

export async function sendInvoiceEmailAction(
  invoiceId: number,
  _prevState: SendState,
  formData: FormData
): Promise<SendState> {
  const to = String(formData.get("to") ?? "").trim();
  const message = String(formData.get("message") ?? "");
  if (!to) return { status: "error", message: "Enter a recipient email address." };

  try {
    await sendInvoiceByEmail(invoiceId, to, message);
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/invoices");
    return { status: "success", message: `Sent to ${to}.` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function sendQuotationEmailAction(
  quotationId: number,
  _prevState: SendState,
  formData: FormData
): Promise<SendState> {
  const to = String(formData.get("to") ?? "").trim();
  const message = String(formData.get("message") ?? "");
  if (!to) return { status: "error", message: "Enter a recipient email address." };

  try {
    await sendQuotationByEmail(quotationId, to, message);
    revalidatePath(`/quotations/${quotationId}`);
    revalidatePath("/quotations");
    return { status: "success", message: `Sent to ${to}.` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function sendPurchaseOrderEmailAction(
  poId: number,
  _prevState: SendState,
  formData: FormData
): Promise<SendState> {
  const to = String(formData.get("to") ?? "").trim();
  const message = String(formData.get("message") ?? "");
  if (!to) return { status: "error", message: "Enter a recipient email address." };

  try {
    await sendPurchaseOrderByEmail(poId, to, message);
    revalidatePath(`/purchase-orders/${poId}`);
    revalidatePath("/purchase-orders");
    return { status: "success", message: `Sent to ${to}.` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function sendJobCardEmailAction(
  jobId: number,
  _prevState: SendState,
  formData: FormData
): Promise<SendState> {
  const to = String(formData.get("to") ?? "").trim();
  const message = String(formData.get("message") ?? "");
  if (!to) return { status: "error", message: "Enter a recipient email address." };

  try {
    await sendJobCardByEmail(jobId, to, message);
    revalidatePath(`/job-cards/${jobId}`);
    revalidatePath("/job-cards");
    return { status: "success", message: `Sent to ${to}.` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function sendDeliveryNoteEmailAction(
  dnId: number,
  _prevState: SendState,
  formData: FormData
): Promise<SendState> {
  const to = String(formData.get("to") ?? "").trim();
  const message = String(formData.get("message") ?? "");
  if (!to) return { status: "error", message: "Enter a recipient email address." };

  try {
    await sendDeliveryNoteByEmail(dnId, to, message);
    revalidatePath(`/delivery-notes/${dnId}`);
    revalidatePath("/delivery-notes");
    return { status: "success", message: `Sent to ${to}.` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Something went wrong." };
  }
}
