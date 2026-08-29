"use server";

import {
  sendInvoiceByEmail,
  sendInvoiceByWhatsApp,
  sendPaymentReminder,
  sendQuotationByEmail,
  sendPurchaseOrderByEmail,
  sendJobCardByEmail,
  sendDeliveryNoteByEmail,
} from "@/lib/send";
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

export async function sendInvoiceWhatsAppAction(
  invoiceId: number,
  _prevState: SendState,
  formData: FormData
): Promise<SendState> {
  const toPhone = String(formData.get("toPhone") ?? "").trim();
  if (!toPhone) return { status: "error", message: "Enter a WhatsApp number." };

  try {
    const summary = await sendInvoiceByWhatsApp(invoiceId, toPhone);
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/invoices");
    const wa = summary.results.find((r) => r.channel === "whatsapp");
    if (wa?.delivered) return { status: "success", message: wa.message ?? "WhatsApp message sent." };
    return {
      status: "error",
      message: wa?.message ?? wa?.error ?? "WhatsApp message was not sent.",
    };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function sendPaymentReminderAction(
  invoiceId: number,
  _prevState: SendState,
  formData: FormData
): Promise<SendState> {
  const to = String(formData.get("to") ?? "").trim();
  const toPhone = String(formData.get("toPhone") ?? "").trim();
  if (!to && !toPhone) {
    return { status: "error", message: "Enter an email address or WhatsApp number." };
  }

  try {
    const summary = await sendPaymentReminder(invoiceId, { email: to || null, phone: toPhone || null });
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/invoices");

    const parts: string[] = [];
    for (const r of summary.results) {
      if (r.channel === "whatsapp" && !r.delivered) {
        parts.push(`WhatsApp skipped (${r.message ?? r.error ?? "not delivered"})`);
      } else if (r.delivered) {
        parts.push(r.message ?? r.channel);
      }
    }
    return { status: "success", message: parts.join(" ") || "Payment reminder sent." };
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
