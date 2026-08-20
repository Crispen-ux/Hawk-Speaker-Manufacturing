import { db } from "@/db";
import { invoices, quotations, clients, purchaseOrders, jobCards, deliveryNotes } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getSettings } from "@/lib/numbering";
import { renderDocPDFBuffer, renderStatementPDFBuffer } from "@/lib/pdf-render";
import { sendEmail } from "@/lib/email";
import { calcTotals, formatMoney, formatDate, toNumber } from "@/lib/money";
import { buildDocumentEmail, type EmailCompany } from "@/lib/email-templates";
import { getBaseUrl } from "@/lib/base-url";

function companyForEmail(settings: {
  companyName: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  bankDetails: string | null;
  logoData: string | null;
}): EmailCompany {
  const baseUrl = getBaseUrl();
  return {
    name: settings.companyName,
    address: settings.address,
    email: settings.email,
    phone: settings.phone,
    bankDetails: settings.bankDetails,
    logoUrl: settings.logoData && baseUrl ? `${baseUrl}/api/settings/logo` : null,
  };
}

export async function sendInvoiceByEmail(invoiceId: number, to: string, message?: string) {
  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, invoiceId),
    with: { client: true, items: true, payments: true },
  });
  if (!invoice) throw new Error("Invoice not found");

  const settings = await getSettings();
  const paid = invoice.payments.reduce((s, p) => s + toNumber(p.amount), 0);
  const { total } = calcTotals(invoice.items, invoice.taxRate, invoice.discount);
  const balance = Math.max(total - paid, 0);

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
      companyName: settings.companyName,
      email: settings.email,
      phone: settings.phone,
      address: settings.address,
      bankDetails: settings.bankDetails,
      logoData: settings.logoData,
    },
  });

  const html = buildDocumentEmail({
    kicker: "Invoice",
    heading: `Invoice ${invoice.number}`,
    greeting: `Please find attached invoice ${invoice.number} for ${formatMoney(total)}, due ${formatDate(invoice.dueDate)}.`,
    message,
    recipientName: invoice.client?.name,
    detailRows: [
      { label: "Invoice number", value: invoice.number },
      { label: "Issue date", value: formatDate(invoice.issueDate) },
      { label: "Due date", value: formatDate(invoice.dueDate) },
    ],
    highlight: { label: paid > 0 ? "Balance due" : "Amount due", value: formatMoney(balance) },
    attachmentLabel: `${invoice.number}.pdf`,
    company: companyForEmail(settings),
  });

  await sendEmail({
    to,
    subject: `Invoice ${invoice.number} from ${settings.companyName}`,
    html,
    attachments: [{ filename: `${invoice.number}.pdf`, content: buffer.toString("base64") }],
  });

  await db
    .update(invoices)
    .set({ lastSentAt: new Date(), status: invoice.status === "draft" ? "sent" : invoice.status })
    .where(eq(invoices.id, invoiceId));
}

export async function sendQuotationByEmail(quotationId: number, to: string, message?: string) {
  const quotation = await db.query.quotations.findFirst({
    where: eq(quotations.id, quotationId),
    with: { client: true, items: true },
  });
  if (!quotation) throw new Error("Quotation not found");

  const settings = await getSettings();
  const { total } = calcTotals(quotation.items, quotation.taxRate, quotation.discount);

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
      companyName: settings.companyName,
      email: settings.email,
      phone: settings.phone,
      address: settings.address,
      bankDetails: settings.bankDetails,
      logoData: settings.logoData,
    },
  });

  const html = buildDocumentEmail({
    kicker: "Quotation",
    heading: `Quotation ${quotation.number}`,
    greeting: `Please find attached quotation ${quotation.number} for ${formatMoney(total)}, valid until ${formatDate(quotation.expiryDate)}.`,
    message,
    recipientName: quotation.client?.name,
    detailRows: [
      { label: "Quotation number", value: quotation.number },
      { label: "Issue date", value: formatDate(quotation.issueDate) },
      { label: "Valid until", value: formatDate(quotation.expiryDate) },
    ],
    highlight: { label: "Total", value: formatMoney(total) },
    attachmentLabel: `${quotation.number}.pdf`,
    company: companyForEmail(settings),
  });

  await sendEmail({
    to,
    subject: `Quotation ${quotation.number} from ${settings.companyName}`,
    html,
    attachments: [{ filename: `${quotation.number}.pdf`, content: buffer.toString("base64") }],
  });

  await db
    .update(quotations)
    .set({ lastSentAt: new Date(), status: quotation.status === "draft" ? "sent" : quotation.status })
    .where(eq(quotations.id, quotationId));
}

export async function sendStatementByEmail(
  clientId: number,
  to: string,
  fromDate: string,
  toDate: string,
  message?: string
) {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!client) throw new Error("Client not found");

  const settings = await getSettings();

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
    company: {
      companyName: settings.companyName,
      email: settings.email,
      phone: settings.phone,
      address: settings.address,
      logoData: settings.logoData,
    },
  });

  const html = buildDocumentEmail({
    kicker: "Statement of account",
    heading: `Statement for ${client.name}`,
    greeting: `Please find attached your statement of account for ${formatDate(fromDate)} to ${formatDate(toDate)}.`,
    message,
    recipientName: client.name,
    detailRows: [
      { label: "Period", value: `${formatDate(fromDate)} — ${formatDate(toDate)}` },
      { label: "Invoices included", value: String(statementRows.length) },
    ],
    highlight: { label: "Outstanding balance", value: formatMoney(outstanding) },
    attachmentLabel: `statement-${clientName}.pdf`,
    company: companyForEmail(settings),
  });

  await sendEmail({
    to,
    subject: `Statement of account from ${settings.companyName}`,
    html,
    attachments: [{ filename: `statement-${clientName}.pdf`, content: buffer.toString("base64") }],
  });
}

export async function sendPurchaseOrderByEmail(poId: number, to: string, message?: string) {
  const po = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, poId),
    with: { supplier: true, items: true },
  });
  if (!po) throw new Error("Purchase order not found");

  const settings = await getSettings();
  const { total } = calcTotals(po.items, po.taxRate, po.discount);

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
    company: {
      companyName: settings.companyName,
      email: settings.email,
      phone: settings.phone,
      address: settings.address,
      bankDetails: settings.bankDetails,
      logoData: settings.logoData,
    },
  });

  const html = buildDocumentEmail({
    kicker: "Purchase order",
    heading: `Purchase order ${po.number}`,
    greeting: `Please find attached purchase order ${po.number} for ${formatMoney(total)}.`,
    message,
    recipientName: po.supplier?.name,
    detailRows: [
      { label: "PO number", value: po.number },
      { label: "Issue date", value: formatDate(po.issueDate) },
      ...(po.expectedDate ? [{ label: "Expected delivery", value: formatDate(po.expectedDate) }] : []),
    ],
    highlight: { label: "Order total", value: formatMoney(total) },
    attachmentLabel: `${po.number}.pdf`,
    company: companyForEmail(settings),
  });

  await sendEmail({
    to,
    subject: `Purchase order ${po.number} from ${settings.companyName}`,
    html,
    attachments: [{ filename: `${po.number}.pdf`, content: buffer.toString("base64") }],
  });

  await db
    .update(purchaseOrders)
    .set({ lastSentAt: new Date(), status: po.status === "draft" ? "sent" : po.status })
    .where(eq(purchaseOrders.id, poId));
}

export async function sendJobCardByEmail(jobId: number, to: string, message?: string) {
  const job = await db.query.jobCards.findFirst({
    where: eq(jobCards.id, jobId),
    with: { client: true, items: true },
  });
  if (!job) throw new Error("Job card not found");

  const settings = await getSettings();
  const hasItems = job.items.length > 0;
  const { total } = calcTotals(job.items, job.taxRate, job.discount);

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
    company: {
      companyName: settings.companyName,
      email: settings.email,
      phone: settings.phone,
      address: settings.address,
      bankDetails: settings.bankDetails,
      logoData: settings.logoData,
    },
  });

  const html = buildDocumentEmail({
    kicker: "Job card",
    heading: `Job card ${job.number}`,
    greeting: `Please find attached job card ${job.number} — ${job.title}.`,
    message,
    recipientName: job.client?.name,
    detailRows: [
      { label: "Job card number", value: job.number },
      { label: "Opened", value: formatDate(job.openedDate) },
      ...(job.technician ? [{ label: "Technician", value: job.technician }] : []),
    ],
    highlight: hasItems ? { label: "Total", value: formatMoney(total) } : { label: "Status", value: job.status.replace(/_/g, " ") },
    attachmentLabel: `${job.number}.pdf`,
    company: companyForEmail(settings),
  });

  await sendEmail({
    to,
    subject: `Job card ${job.number} from ${settings.companyName}`,
    html,
    attachments: [{ filename: `${job.number}.pdf`, content: buffer.toString("base64") }],
  });

  await db.update(jobCards).set({ lastSentAt: new Date() }).where(eq(jobCards.id, jobId));
}

export async function sendDeliveryNoteByEmail(dnId: number, to: string, message?: string) {
  const dn = await db.query.deliveryNotes.findFirst({
    where: eq(deliveryNotes.id, dnId),
    with: { client: true, items: true },
  });
  if (!dn) throw new Error("Delivery note not found");

  const settings = await getSettings();

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
    company: {
      companyName: settings.companyName,
      email: settings.email,
      phone: settings.phone,
      address: settings.address,
      bankDetails: settings.bankDetails,
      logoData: settings.logoData,
    },
  });

  const html = buildDocumentEmail({
    kicker: "Delivery note",
    heading: `Delivery note ${dn.number}`,
    greeting: `Please find attached delivery note ${dn.number} confirming ${dn.items.length} item(s) delivered on ${formatDate(dn.deliveryDate)}.`,
    message,
    recipientName: dn.client?.name,
    detailRows: [
      { label: "Delivery note number", value: dn.number },
      { label: "Delivery date", value: formatDate(dn.deliveryDate) },
      { label: "Items", value: String(dn.items.length) },
    ],
    highlight: { label: "Status", value: dn.status },
    attachmentLabel: `${dn.number}.pdf`,
    company: companyForEmail(settings),
  });

  await sendEmail({
    to,
    subject: `Delivery note ${dn.number} from ${settings.companyName}`,
    html,
    attachments: [{ filename: `${dn.number}.pdf`, content: buffer.toString("base64") }],
  });

  await db
    .update(deliveryNotes)
    .set({ lastSentAt: new Date(), status: dn.status === "draft" ? "delivered" : dn.status })
    .where(eq(deliveryNotes.id, dnId));
}
