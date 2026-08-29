import { dispatch } from "./index";
import { getSettings } from "@/lib/numbering";
import { getWhatsAppTemplates } from "./templates";
import { renderTemplate } from "@/lib/email-templates";
import { publicDocumentUrl } from "@/lib/public-links";
import type { SharedLinkKind, PersistedLinkKind } from "@/lib/public-links";
import type { SendSummary } from "./types";

const LINK_KINDS: Record<string, PersistedLinkKind> = {
  invoice: "invoice",
  quotation: "quotation",
  deliveryNote: "deliveryNote",
};

/**
 * Sends a "here's a document" open link over WhatsApp. Use when the recipient
 * only has a phone number or when attaching a PDF isn't appropriate. Always
 * returns gracefully — a skipped/failed message never throws.
 */
export async function sendDocumentLinkByWhatsApp(data: {
  documentType: keyof typeof LINK_KINDS | SharedLinkKind | "other";
  documentNumber: string;
  documentId?: number;
  recipientName?: string | null;
  toPhone?: string | null;
}): Promise<SendSummary> {
  const settings = await getSettings();
  const templates = getWhatsAppTemplates(settings);

  let link = "";
  if (data.documentId && data.documentType in LINK_KINDS) {
    link = await publicDocumentUrl({
      kind: LINK_KINDS[data.documentType],
      documentId: data.documentId,
    });
  }

  const text = renderTemplate(templates.documentLink, {
    companyName: settings.companyName,
    type: data.documentType === "other" ? "document" : data.documentType,
    number: data.documentNumber,
    link,
  });

  return dispatch(
    {
      type: "documentLink",
      toPhone: data.toPhone,
      text,
      link: link || undefined,
      tokens: { companyName: settings.companyName, type: data.documentType, number: data.documentNumber, link },
    },
    { channels: ["whatsapp"] }
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

/**
 * Generic system notification (e.g. an internal alert). Email only, and
 * always graceful: returns the summary instead of throwing.
 */
export async function sendSystemNotification(data: {
  toEmail: string;
  subject: string;
  body: string;
}): Promise<SendSummary> {
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif; font-size:15px; color:#16212E; line-height:1.6;">
    <p>${escapeHtml(data.body)}</p>
  </body></html>`;

  return dispatch(
    {
      type: "systemNotification",
      toEmail: data.toEmail,
      subject: data.subject,
      html,
      text: data.body,
    },
    { channels: ["email"] }
  );
}