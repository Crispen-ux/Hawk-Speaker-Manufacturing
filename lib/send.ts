import { db } from "@/db";
import { invoices, quotations, clients, purchaseOrders, jobCards, deliveryNotes } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getSettings } from "@/lib/numbering";
import { companyFromSettings } from "@/lib/company";
import { renderDocPDFBuffer, renderStatementPDFBuffer } from "@/lib/pdf-render";
import { calcTotals, formatMoney, formatDate, toNumber } from "@/lib/money";
import {
  buildDocumentEmail,
  getEmailTemplates,
  renderTemplate,
  type EmailCompany,
} from "@/lib/email-templates";
import { getWhatsAppTemplates } from "@/lib/communications/templates";
import { publicDocumentUrl } from "@/lib/public-links";
import { getBaseUrl } from "@/lib/base-url";
import { logAudit } from "@/lib/audit";
import { waMeUrl, normalizeWaPhone } from "@/lib/whatsapp-deeplink";
import {
  dispatch,
  type ChannelName,
  type CommunicationMessage,
  type SendSummary,
} from "@/lib/communications";

type Settings = Awaited<ReturnType<typeof getSettings>>;
type Recipients = { email?: string | null; phone?: string | null };

function companyForEmail(settings: {
  companyName: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  bankDetails: string | null;
  logoData: string | null;
  registrationNumber: string | null;
  vatNumber: string | null;
}): EmailCompany {
  const baseUrl = getBaseUrl();
  return {
    name: settings.companyName,
    address: settings.address,
    email: settings.email,
    phone: settings.phone,
    bankDetails: settings.bankDetails,
    registrationNumber: settings.registrationNumber,
    vatNumber: settings.vatNumber,
    logoUrl: settings.logoData && baseUrl ? `${baseUrl}/api/settings/logo` : null,
  };
}

function money(settings: Settings) {
  return (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");
}

function emailResult(summary: SendSummary) {
  return summary.results.find((r) => r.channel === "email");
}

function auditSent(
  kind: string,
  documentId: number,
  documentNumber: string | undefined,
  action: "sent_email" | "sent_whatsapp",
  extra?: string
) {
  void logAudit({ documentKind: kind, documentId, documentNumber, action, detail: extra });
}

/** Primary-channel guard: email sends that failed are surfaced to the caller. */
function assertEmailDelivered(summary: SendSummary) {
  const r = emailResult(summary);
  if (!r?.delivered) {
    throw new Error(r?.message ?? r?.error ?? "Email was not sent.");
  }
}

async function deliverEmailOrThrow(message: CommunicationMessage): Promise<SendSummary> {
  const summary = await dispatch(message, { channels: ["email"] });
  assertEmailDelivered(summary);
  return summary;
}

/* ------------------------------------------------------------------ */
/* Invoice                                                             */
/* ------------------------------------------------------------------ */

async function buildInvoiceDelivery(
  invoiceId: number,
  recipients: Recipients = {},
  extraMessage?: string
) {
  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, invoiceId),
    with: { client: true, items: true, payments: true },
  });
  if (!invoice) throw new Error("Invoice not found");

  const settings = await getSettings();
  const fmt = money(settings);
  const paid = invoice.payments.reduce((s, p) => s + toNumber(p.amount), 0);
  const { total } = calcTotals(invoice.items, invoice.taxRate, invoice.discount);
  const balance = Math.max(total - paid, 0);
  const emailTemplates = getEmailTemplates(settings);
  const waTemplates = getWhatsAppTemplates(settings);

  const buffer = await renderDocPDFBuffer({
    kind: "Invoice",
    number: invoice.number,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueOrExpiryLabel: "Due",
    dueOrExpiryDate: invoice.dueDate,
    client: {
      name: invoice.client?.name ?? "",
      email: invoice.client?.email,
      address: invoice.client?.address,
    },
    items: invoice.items,
    taxRate: invoice.taxRate,
    discount: invoice.discount,
    notes: invoice.notes,
    paid,
    company: {
      ...companyFromSettings(settings),
      paymentTerms: invoice.paymentTerms ?? companyFromSettings(settings).paymentTerms,
    },
  });

  const vars = {
    companyName: settings.companyName,
    number: invoice.number,
    total: fmt(total),
    dueDate: formatDate(invoice.dueDate),
    clientName: invoice.client?.name ?? "",
  };
  const link = await publicDocumentUrl({ kind: "invoice", documentId: invoiceId });

  const html = buildDocumentEmail({
    kicker: "Invoice",
    heading: `Invoice ${invoice.number}`,
    greeting: renderTemplate(emailTemplates.invoice.greeting, vars),
    message: extraMessage,
    recipientName: invoice.client?.name,
    detailRows: [
      { label: "Invoice number", value: invoice.number },
      { label: "Issue date", value: formatDate(invoice.issueDate) },
      { label: "Due date", value: formatDate(invoice.dueDate) },
    ],
    highlight: { label: paid > 0 ? "Balance due" : "Amount due", value: fmt(balance) },
    attachmentLabel: `${invoice.number}.pdf`,
    company: companyForEmail(settings),
  });

  const message: CommunicationMessage = {
    type: "invoice",
    toEmail: recipients.email ?? undefined,
    toPhone: recipients.phone ?? undefined,
    subject: renderTemplate(emailTemplates.invoice.subject, vars),
    html,
    text: renderTemplate(waTemplates.invoice, { ...vars, link }),
    link: link || undefined,
    attachment: { filename: `${invoice.number}.pdf`, contentBase64: buffer.toString("base64") },
    tokens: vars,
  };

  return { message, settings, status: invoice.status, fmt, paid, total, balance, vars, link };
}

export async function sendInvoiceByEmail(invoiceId: number, to: string, message?: string) {
  const built = await buildInvoiceDelivery(invoiceId, { email: to }, message);
  const summary = await deliverEmailOrThrow(built.message);
  await db
    .update(invoices)
    .set({ lastSentAt: new Date(), status: built.status === "draft" ? "sent" : built.status })
    .where(eq(invoices.id, invoiceId));
  auditSent("invoice", invoiceId, built.vars.number, "sent_email", to);
  return summary;
}

/**
 * WhatsApp is an optional channel: failures are folded into the returned
 * summary and never thrown, so an invoice that's already saved can never be
 * rolled back by a message that couldn't be delivered.
 */
export async function sendInvoiceByWhatsApp(invoiceId: number, toPhone?: string) {
  const built = await buildInvoiceDelivery(invoiceId, { phone: toPhone });
  const summary = await dispatch(built.message, { channels: ["whatsapp"] });
  if (summary.results.some((r) => r.channel === "whatsapp" && r.delivered)) {
    await db
      .update(invoices)
      .set({ lastSentAt: new Date(), status: built.status === "draft" ? "sent" : built.status })
      .where(eq(invoices.id, invoiceId));
    auditSent("invoice", invoiceId, built.vars.number, "sent_whatsapp", toPhone ?? undefined);
  }
  return summary;
}

export async function sendPaymentReminder(
  invoiceId: number,
  recipients: Recipients = {},
  extraMessage?: string
) {
  const built = await buildInvoiceDelivery(invoiceId, recipients, extraMessage);
  const emailTemplates = getEmailTemplates(built.settings);
  const waTemplates = getWhatsAppTemplates(built.settings);
  const vars = {
    ...built.vars,
    outstanding: built.fmt(built.balance),
  };
  const link = built.link;
  const subject = renderTemplate(emailTemplates.paymentReminder.subject, vars);
  const html = buildDocumentEmail({
    kicker: "Payment reminder",
    heading: `Invoice ${built.vars.number} — payment reminder`,
    greeting: renderTemplate(emailTemplates.paymentReminder.greeting, vars),
    message: extraMessage,
    recipientName: built.vars.clientName,
    detailRows: [
      { label: "Invoice number", value: built.vars.number },
      { label: "Due date", value: built.vars.dueDate },
    ],
    highlight: { label: "Amount outstanding", value: vars.outstanding },
    attachmentLabel: `${built.vars.number}.pdf`,
    company: companyForEmail(built.settings),
  });

  const message: CommunicationMessage = {
    ...built.message,
    type: "paymentReminder",
    subject,
    html,
    text: renderTemplate(waTemplates.paymentReminder, { ...vars, link }),
  };

  const channels: ChannelName[] = [];
  if (recipients.email) channels.push("email");
  if (recipients.phone) channels.push("whatsapp");

  const summary = await dispatch(message, { channels });
  if (recipients.email) assertEmailDelivered(summary);
  void logAudit({
    documentKind: "invoice",
    documentId: invoiceId,
    documentNumber: built.vars.number,
    action: "reminder_sent",
    detail: [recipients.email ?? "", recipients.phone ?? ""].filter(Boolean).join(", ") || undefined,
  });
  return summary;
}

/* ------------------------------------------------------------------ */
/* Quotation                                                           */
/* ------------------------------------------------------------------ */

async function buildQuotationDelivery(
  quotationId: number,
  recipients: Recipients = {},
  extraMessage?: string
) {
  const quotation = await db.query.quotations.findFirst({
    where: eq(quotations.id, quotationId),
    with: { client: true, items: true },
  });
  if (!quotation) throw new Error("Quotation not found");

  const settings = await getSettings();
  const fmt = money(settings);
  const { total } = calcTotals(quotation.items, quotation.taxRate, quotation.discount);
  const emailTemplates = getEmailTemplates(settings);
  const waTemplates = getWhatsAppTemplates(settings);

  const buffer = await renderDocPDFBuffer({
    kind: "Quotation",
    number: quotation.number,
    status: quotation.status,
    issueDate: quotation.issueDate,
    dueOrExpiryLabel: "Valid until",
    dueOrExpiryDate: quotation.expiryDate,
    client: {
      name: quotation.client?.name ?? "",
      email: quotation.client?.email,
      address: quotation.client?.address,
    },
    items: quotation.items,
    taxRate: quotation.taxRate,
    discount: quotation.discount,
    notes: quotation.notes,
    company: {
      ...companyFromSettings(settings),
      paymentTerms: quotation.paymentTerms ?? companyFromSettings(settings).paymentTerms,
    },
  });

  const vars = {
    companyName: settings.companyName,
    number: quotation.number,
    total: fmt(total),
    validUntil: formatDate(quotation.expiryDate),
    clientName: quotation.client?.name ?? "",
  };
  const link = await publicDocumentUrl({ kind: "quotation", documentId: quotationId });

  const html = buildDocumentEmail({
    kicker: "Quotation",
    heading: `Quotation ${quotation.number}`,
    greeting: renderTemplate(emailTemplates.quotation.greeting, vars),
    message: extraMessage,
    recipientName: quotation.client?.name,
    detailRows: [
      { label: "Quotation number", value: quotation.number },
      { label: "Issue date", value: formatDate(quotation.issueDate) },
      { label: "Valid until", value: formatDate(quotation.expiryDate) },
    ],
    highlight: { label: "Total", value: vars.total },
    attachmentLabel: `${quotation.number}.pdf`,
    company: companyForEmail(settings),
  });

  const message: CommunicationMessage = {
    type: "quotation",
    toEmail: recipients.email ?? undefined,
    toPhone: recipients.phone ?? undefined,
    subject: renderTemplate(emailTemplates.quotation.subject, vars),
    html,
    text: renderTemplate(waTemplates.quotation, { ...vars, link }),
    link: link || undefined,
    attachment: { filename: `${quotation.number}.pdf`, contentBase64: buffer.toString("base64") },
    tokens: vars,
  };

  return { message, status: quotation.status };
}

export async function sendQuotationByEmail(quotationId: number, to: string, message?: string) {
  const built = await buildQuotationDelivery(quotationId, { email: to }, message);
  const summary = await deliverEmailOrThrow(built.message);
  await db
    .update(quotations)
    .set({ lastSentAt: new Date(), status: built.status === "draft" ? "sent" : built.status })
    .where(eq(quotations.id, quotationId));
  auditSent("quotation", quotationId, built.message.tokens?.number, "sent_email", to);
  return summary;
}

export async function sendQuotationByWhatsApp(quotationId: number, toPhone?: string) {
  const built = await buildQuotationDelivery(quotationId, { phone: toPhone });
  const summary = await dispatch(built.message, { channels: ["whatsapp"] });
  if (summary.results.some((r) => r.channel === "whatsapp" && r.delivered)) {
    await db
      .update(quotations)
      .set({ lastSentAt: new Date(), status: built.status === "draft" ? "sent" : built.status })
      .where(eq(quotations.id, quotationId));
    auditSent("quotation", quotationId, built.message.tokens?.number, "sent_whatsapp", toPhone ?? undefined);
  }
  return summary;
}

/* ------------------------------------------------------------------ */
/* Statement                                                           */
/* ------------------------------------------------------------------ */

async function buildStatementDelivery(
  clientId: number,
  toEmail: string,
  fromDate: string,
  toDate: string,
  recipients: Recipients,
  extraMessage?: string
) {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!client) throw new Error("Client not found");

  const settings = await getSettings();
  const fmt = money(settings);
  const emailTemplates = getEmailTemplates(settings);
  const waTemplates = getWhatsAppTemplates(settings);

  const rows = await db.query.invoices.findMany({
    where: and(eq(invoices.clientId, clientId), gte(invoices.issueDate, fromDate), lte(invoices.issueDate, toDate)),
    with: { payments: true, items: true },
    orderBy: (invoices, { asc }) => [asc(invoices.issueDate)],
  });

  const statementRows = rows.map((inv) => {
    const { total } = calcTotals(inv.items, inv.taxRate, inv.discount);
    const paid = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
    return { date: inv.issueDate, number: inv.number, status: inv.status, total, paid };
  });

  const outstanding = statementRows.reduce((s, r) => s + Math.max(r.total - r.paid, 0), 0);
  const clientName = client.name.replace(/\s+/g, "-");

  const buffer = await renderStatementPDFBuffer({
    client: { name: client.name, email: client.email, address: client.address },
    fromDate,
    toDate,
    rows: statementRows,
    company: companyFromSettings(settings),
  });

  const period = `${formatDate(fromDate)} — ${formatDate(toDate)}`;
  const vars = {
    companyName: settings.companyName,
    clientName: client.name,
    period,
    invoiceCount: String(statementRows.length),
    outstanding: fmt(outstanding),
  };
  const link = await publicDocumentUrl({ kind: "statement", clientId: client.id, fromDate, toDate });

  const html = buildDocumentEmail({
    kicker: "Statement of account",
    heading: `Statement for ${client.name}`,
    greeting: renderTemplate(emailTemplates.statement.greeting, vars),
    message: extraMessage,
    recipientName: client.name,
    detailRows: [
      { label: "Period", value: period },
      { label: "Invoices included", value: String(statementRows.length) },
    ],
    highlight: { label: "Outstanding balance", value: vars.outstanding },
    attachmentLabel: `statement-${clientName}.pdf`,
    company: companyForEmail(settings),
  });

  const message: CommunicationMessage = {
    type: "statement",
    toEmail: toEmail || recipients.email || undefined,
    toPhone: recipients.phone ?? undefined,
    subject: renderTemplate(emailTemplates.statement.subject, vars),
    html,
    text: renderTemplate(waTemplates.statement, { ...vars, link }),
    link: link || undefined,
    attachment: {
      filename: `statement-${clientName}.pdf`,
      contentBase64: buffer.toString("base64"),
    },
    tokens: vars,
  };

  return { message, client };
}

export async function sendStatementByEmail(
  clientId: number,
  to: string,
  fromDate: string,
  toDate: string,
  message?: string
) {
  const built = await buildStatementDelivery(clientId, to, fromDate, toDate, {}, message);
  const summary = await deliverEmailOrThrow(built.message);
  void logAudit({
    documentKind: "statement",
    documentId: 0,
    action: "sent_email",
    detail: `client ${built.client.name} · ${fromDate} → ${toDate} · ${to}`,
  });
  return summary;
}

export async function sendStatementByWhatsApp(
  clientId: number,
  fromDate: string,
  toDate: string,
  toPhone?: string
) {
  const built = await buildStatementDelivery(clientId, "", fromDate, toDate, { phone: toPhone });
  const summary = await dispatch(built.message, { channels: ["whatsapp"] });
  void logAudit({
    documentKind: "statement",
    documentId: 0,
    action: "sent_whatsapp",
    detail: `client ${built.client.name} · ${fromDate} → ${toDate} · ${toPhone ?? ""}`.trim(),
  });
  return summary;
}

/** Builds a wa.me deep link for a client's statement — message + public link included. */
export async function buildStatementWhatsAppUrl(
  clientId: number,
  fromDate: string,
  toDate: string,
  phone: string
): Promise<string> {
  const built = await buildStatementDelivery(clientId, "", fromDate, toDate, {});
  const digits = normalizeWaPhone(phone);
  if (!digits) throw new Error("Enter a valid WhatsApp number, e.g. +27 82 000 0000.");
  return waMeUrl(digits, built.message.text);
}

/* ------------------------------------------------------------------ */
/* Purchase order                                                      */
/* ------------------------------------------------------------------ */

export async function sendPurchaseOrderByEmail(poId: number, to: string, message?: string) {
  const po = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, poId),
    with: { supplier: true, items: true },
  });
  if (!po) throw new Error("Purchase order not found");

  const settings = await getSettings();
  const fmt = money(settings);
  const { total } = calcTotals(po.items, po.taxRate, po.discount);
  const emailTemplates = getEmailTemplates(settings);

  const buffer = await renderDocPDFBuffer({
    kind: "Purchase Order",
    number: po.number,
    status: po.status,
    issueDate: po.issueDate,
    dueOrExpiryLabel: "Expected delivery",
    dueOrExpiryDate: po.expectedDate ?? "",
    partyLabel: "Supplier",
    client: {
      name: po.supplier?.name ?? "",
      email: po.supplier?.email,
      address: po.supplier?.address,
    },
    items: po.items,
    taxRate: po.taxRate,
    discount: po.discount,
    notes: po.notes,
    company: companyFromSettings(settings),
  });

  const vars = {
    companyName: settings.companyName,
    number: po.number,
    total: fmt(total),
    expected: po.expectedDate ? formatDate(po.expectedDate) : "",
    supplierName: po.supplier?.name ?? "",
  };

  const html = buildDocumentEmail({
    kicker: "Purchase order",
    heading: `Purchase order ${po.number}`,
    greeting: renderTemplate(emailTemplates.purchaseOrder.greeting, vars),
    message,
    recipientName: po.supplier?.name,
    detailRows: [
      { label: "PO number", value: po.number },
      { label: "Issue date", value: formatDate(po.issueDate) },
      ...(po.expectedDate ? [{ label: "Expected delivery", value: formatDate(po.expectedDate) }] : []),
    ],
    highlight: { label: "Order total", value: vars.total },
    attachmentLabel: `${po.number}.pdf`,
    company: companyForEmail(settings),
  });

  const msg: CommunicationMessage = {
    type: "documentLink",
    toEmail: to,
    subject: renderTemplate(emailTemplates.purchaseOrder.subject, vars),
    html,
    text: `Purchase order ${po.number} from ${settings.companyName}`,
    attachment: { filename: `${po.number}.pdf`, contentBase64: buffer.toString("base64") },
    tokens: vars,
  };

  const summary = await deliverEmailOrThrow(msg);
  await db
    .update(purchaseOrders)
    .set({ lastSentAt: new Date(), status: po.status === "draft" ? "sent" : po.status })
    .where(eq(purchaseOrders.id, poId));
  auditSent("purchaseOrder", poId, vars.number, "sent_email", to);
  return summary;
}

/* ------------------------------------------------------------------ */
/* Job card                                                            */
/* ------------------------------------------------------------------ */

export async function sendJobCardByEmail(jobId: number, to: string, message?: string) {
  const job = await db.query.jobCards.findFirst({
    where: eq(jobCards.id, jobId),
    with: { client: true, items: true },
  });
  if (!job) throw new Error("Job card not found");

  const settings = await getSettings();
  const fmt = money(settings);
  const hasItems = job.items.length > 0;
  const { total } = calcTotals(job.items, job.taxRate, job.discount);
  const emailTemplates = getEmailTemplates(settings);

  const extraMeta = [
    job.technician ? { label: "Technician", value: job.technician } : null,
    job.equipment ? { label: "Equipment / asset", value: job.equipment } : null,
  ].filter((m): m is { label: string; value: string } => m !== null);

  const buffer = await renderDocPDFBuffer({
    kind: "Job Card",
    number: job.number,
    status: job.status,
    issueDate: job.openedDate,
    dueOrExpiryLabel: "Completed",
    dueOrExpiryDate: job.completedDate ?? "",
    partyLabel: "Client",
    client: {
      name: job.client?.name ?? "",
      email: job.client?.email,
      address: job.client?.address,
    },
    extraMeta,
    items: job.items,
    taxRate: job.taxRate,
    discount: job.discount,
    notes: [job.title, job.description, job.notes].filter(Boolean).join("\n\n"),
    showPricing: hasItems,
    company: companyFromSettings(settings),
  });

  const vars = {
    companyName: settings.companyName,
    number: job.number,
    title: job.title,
    clientName: job.client?.name ?? "",
    technician: job.technician ?? "",
    status: job.status.replace(/_/g, " "),
    total: hasItems ? fmt(total) : "",
  };

  const html = buildDocumentEmail({
    kicker: "Job card",
    heading: `Job card ${job.number}`,
    greeting: renderTemplate(emailTemplates.jobCard.greeting, vars),
    message,
    recipientName: job.client?.name,
    detailRows: [
      { label: "Job card number", value: job.number },
      { label: "Opened", value: formatDate(job.openedDate) },
      ...(job.technician ? [{ label: "Technician", value: job.technician }] : []),
    ],
    highlight: hasItems ? { label: "Total", value: fmt(total) } : { label: "Status", value: vars.status },
    attachmentLabel: `${job.number}.pdf`,
    company: companyForEmail(settings),
  });

  const msg: CommunicationMessage = {
    type: "documentLink",
    toEmail: to,
    subject: renderTemplate(emailTemplates.jobCard.subject, vars),
    html,
    text: `Job card ${job.number} from ${settings.companyName}`,
    attachment: { filename: `${job.number}.pdf`, contentBase64: buffer.toString("base64") },
    tokens: vars,
  };

  const summary = await deliverEmailOrThrow(msg);
  await db.update(jobCards).set({ lastSentAt: new Date() }).where(eq(jobCards.id, jobId));
  auditSent("jobCard", jobId, vars.number, "sent_email", to);
  return summary;
}

/* ------------------------------------------------------------------ */
/* Delivery note                                                       */
/* ------------------------------------------------------------------ */

async function buildDeliveryNoteDelivery(
  dnId: number,
  recipients: Recipients = {},
  extraMessage?: string
) {
  const dn = await db.query.deliveryNotes.findFirst({
    where: eq(deliveryNotes.id, dnId),
    with: { client: true, items: true },
  });
  if (!dn) throw new Error("Delivery note not found");

  const settings = await getSettings();
  const emailTemplates = getEmailTemplates(settings);
  const waTemplates = getWhatsAppTemplates(settings);

  const extraMeta = [
    dn.deliveredBy ? { label: "Delivered by", value: dn.deliveredBy } : null,
    dn.receivedBy ? { label: "Received by", value: dn.receivedBy } : null,
  ].filter((m): m is { label: string; value: string } => m !== null);

  const buffer = await renderDocPDFBuffer({
    kind: "Delivery Note",
    number: dn.number,
    status: dn.status,
    issueDate: dn.deliveryDate,
    dueOrExpiryLabel: "",
    dueOrExpiryDate: "",
    partyLabel: "Delivered to",
    client: {
      name: dn.client?.name ?? "",
      email: dn.client?.email,
      address: dn.client?.address,
    },
    extraMeta,
    items: dn.items.map((it) => ({ description: it.description, quantity: it.quantity, unitPrice: "0" })),
    taxRate: "0",
    discount: "0",
    notes: dn.notes,
    showPricing: false,
    company: companyFromSettings(settings),
  });

  const vars = {
    companyName: settings.companyName,
    number: dn.number,
    clientName: dn.client?.name ?? "",
    deliveryDate: formatDate(dn.deliveryDate),
    itemCount: String(dn.items.length),
  };
  const link = await publicDocumentUrl({ kind: "deliveryNote", documentId: dnId });

  const html = buildDocumentEmail({
    kicker: "Delivery note",
    heading: `Delivery note ${dn.number}`,
    greeting: renderTemplate(emailTemplates.deliveryNote.greeting, vars),
    message: extraMessage,
    recipientName: dn.client?.name,
    detailRows: [
      { label: "Delivery note number", value: dn.number },
      { label: "Delivery date", value: formatDate(dn.deliveryDate) },
      { label: "Items", value: vars.itemCount },
    ],
    highlight: { label: "Status", value: dn.status },
    attachmentLabel: `${dn.number}.pdf`,
    company: companyForEmail(settings),
  });

  const message: CommunicationMessage = {
    type: "deliveryNotification",
    toEmail: recipients.email ?? undefined,
    toPhone: recipients.phone ?? undefined,
    subject: renderTemplate(emailTemplates.deliveryNote.subject, vars),
    html,
    text: renderTemplate(waTemplates.deliveryNotification, { ...vars, link }),
    link: link || undefined,
    attachment: { filename: `${dn.number}.pdf`, contentBase64: buffer.toString("base64") },
    tokens: vars,
  };

  return { message, status: dn.status };
}

export async function sendDeliveryNoteByEmail(dnId: number, to: string, message?: string) {
  const built = await buildDeliveryNoteDelivery(dnId, { email: to }, message);
  const summary = await deliverEmailOrThrow(built.message);
  await db
    .update(deliveryNotes)
    .set({ lastSentAt: new Date(), status: built.status === "draft" ? "delivered" : built.status })
    .where(eq(deliveryNotes.id, dnId));
  auditSent("deliveryNote", dnId, built.message.tokens?.number, "sent_email", to);
  return summary;
}

export async function sendDeliveryNotificationByWhatsApp(dnId: number, toPhone?: string) {
  const built = await buildDeliveryNoteDelivery(dnId, { phone: toPhone });
  const summary = await dispatch(built.message, { channels: ["whatsapp"] });
  if (summary.results.some((r) => r.channel === "whatsapp" && r.delivered)) {
    await db
      .update(deliveryNotes)
      .set({ lastSentAt: new Date(), status: built.status === "draft" ? "delivered" : built.status })
      .where(eq(deliveryNotes.id, dnId));
    auditSent("deliveryNote", dnId, built.message.tokens?.number, "sent_whatsapp", toPhone ?? undefined);
  }
  return summary;
}