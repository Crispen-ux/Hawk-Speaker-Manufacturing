export const WHATSAPP_TEMPLATE_KEYS = {
  invoice: ["companyName", "number", "total", "dueDate", "clientName", "link"],
  quotation: ["companyName", "number", "total", "validUntil", "clientName", "link", "approvalText"],
  statement: ["companyName", "clientName", "period", "outstanding", "link"],
  paymentReminder: ["companyName", "number", "total", "dueDate", "outstanding", "clientName", "link"],
  deliveryNotification: ["companyName", "number", "clientName", "deliveryDate", "itemCount", "link"],
  documentLink: ["companyName", "type", "number", "link"],
} as const;

export const DEFAULT_WHATSAPP_TEMPLATES: Record<string, string> = {
  invoice: "Hi {clientName}, your invoice {number} for {total} is due by {dueDate}. {link}",
  quotation: "Hi {clientName}, your quotation {number} for {total} is valid until {validUntil}. {link}{approvalText}",
  statement: "Hi {clientName}, here is your statement for {period}. Outstanding: {outstanding}. {link}",
  paymentReminder:
    "Hi {clientName}, a friendly reminder that invoice {number} for {total} is due by {dueDate}. Outstanding: {outstanding}. {link}",
  deliveryNotification:
    "Hi {clientName}, the items on delivery note {number} were delivered on {deliveryDate}. {link}",
  documentLink: "Hi, here is your {type} {number} from {companyName}: {link}",
};

/**
 * WhatsApp message bodies, merging anything the user stored in settings over
 * the built-in defaults. `settings.whatsappTemplates` is a JSON object shaped
 * like `{ invoice: "…", paymentReminder: "…" }`.
 */
export function getWhatsAppTemplates(settings: { whatsappTemplates: string | null }): Record<string, string> {
  const merged: Record<string, string> = { ...DEFAULT_WHATSAPP_TEMPLATES };
  if (settings.whatsappTemplates) {
    try {
      const stored = JSON.parse(settings.whatsappTemplates) as Record<string, unknown>;
      for (const [key, value] of Object.entries(stored)) {
        if (typeof value === "string" && Object.prototype.hasOwnProperty.call(merged, key)) {
          merged[key] = value;
        }
      }
    } catch {
      // Ignore malformed stored JSON and fall back to defaults.
    }
  }
  return merged;
}