import { calcTotals, formatMoney, toNumber } from "@/lib/money";

export type WaMessageDoc = {
  number: string;
  status: string;
  clientName?: string | null;
  items: { description: string; quantity: string | number; unitPrice: string | number }[];
  taxRate: string | number;
  discount: string | number;
  notes?: string | null;
  paid?: number;
  dueLabel?: string;
  dueValue?: string;
};

export type WaMessageOptions = {
  companyName: string;
  currency: string;
  kindLabel: string;
  link: string;
  showPricing?: boolean;
};

/** Local (SA) numbers become international — 084 123 4567 → 27841234567. */
export function normalizeWaPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = String(input).replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  d = d.replace(/\D/g, "");
  if (d.startsWith("0")) d = "27" + d.slice(1);
  else if (d.length === 9) d = "27" + d;
  return /^\d{9,15}$/.test(d) ? d : null;
}

/** The wa.me deep link WhatsApp opens with the message pre-filled. */
export function waMeUrl(phone: string, message: string): string {
  const digits = normalizeWaPhone(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** A human-readable document summary, ready to paste into a WhatsApp message. */
export function buildDocumentWaMessage(doc: WaMessageDoc, opts: WaMessageOptions): string {
  const fmt = (v: string | number | null | undefined) => formatMoney(v, opts.currency);
  const lines: string[] = [opts.companyName, `${opts.kindLabel} ${doc.number}`];

  if (doc.dueLabel && doc.dueValue) lines.push(`${doc.dueLabel}: ${doc.dueValue}`);
  lines.push(`Status: ${doc.status}`);
  if (doc.clientName) lines.push(`Client: ${doc.clientName}`);
  lines.push("");

  for (const it of doc.items) {
    const qty = toNumber(it.quantity);
    const desc = it.description || "Item";
    if (opts.showPricing) {
      lines.push(`• ${qty}× ${desc} — ${fmt(qty * toNumber(it.unitPrice))}`);
    } else {
      lines.push(`• ${qty}× ${desc}`);
    }
  }

  if (opts.showPricing && doc.items.length > 0) {
    const { subtotal, discount, tax, total } = calcTotals(doc.items, doc.taxRate, doc.discount);
    lines.push("");
    lines.push(`Subtotal: ${fmt(subtotal)}`);
    if (discount > 0) lines.push(`Discount: -${fmt(discount)}`);
    if (tax > 0) lines.push(`VAT: ${fmt(tax)}`);
    lines.push(`Total: ${fmt(total)}`);
    if (typeof doc.paid === "number" && doc.paid > 0) {
      lines.push(`Paid: ${fmt(doc.paid)}`);
      lines.push(`Balance due: ${fmt(Math.max(total - doc.paid, 0))}`);
    }
  }

  if (doc.notes?.trim()) lines.push("", `Notes: ${doc.notes.trim()}`);
  if (opts.link) lines.push("", `View online: ${opts.link}`);

  return lines.join("\n");
}