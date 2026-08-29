import { db } from "@/db";
import { invoices, quotations, clients, deliveryNotes } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getSettings } from "@/lib/numbering";
import { companyFromSettings } from "@/lib/company";
import { renderDocPDFBuffer, renderStatementPDFBuffer } from "@/lib/pdf-render";
import { calcTotals, toNumber } from "@/lib/money";

export type SharedPDF = { buffer: Buffer; filename: string; title: string };

function notFound(): never {
  throw new Error("Document not found");
}

/** Renders the PDF for an invoice — used by both email/WhatsApp sends and the public share route. */
export async function renderInvoicePdf(invoiceId: number): Promise<SharedPDF> {
  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, invoiceId),
    with: { client: true, items: true, payments: true },
  });
  if (!invoice) notFound();

  const settings = await getSettings();
  const paid = invoice.payments.reduce((s, p) => s + toNumber(p.amount), 0);
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
    company: companyFromSettings(settings),
  });

  return { buffer: Buffer.from(buffer), filename: `${invoice.number}.pdf`, title: `Invoice ${invoice.number}` };
}

/** Renders the PDF for a quotation. */
export async function renderQuotationPdf(quotationId: number): Promise<SharedPDF> {
  const quotation = await db.query.quotations.findFirst({
    where: eq(quotations.id, quotationId),
    with: { client: true, items: true },
  });
  if (!quotation) notFound();

  const settings = await getSettings();
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
    company: companyFromSettings(settings),
  });

  return { buffer: Buffer.from(buffer), filename: `${quotation.number}.pdf`, title: `Quotation ${quotation.number}` };
}

/** Renders the PDF for a delivery note (line items shown without pricing). */
export async function renderDeliveryNotePdf(dnId: number): Promise<SharedPDF> {
  const dn = await db.query.deliveryNotes.findFirst({
    where: eq(deliveryNotes.id, dnId),
    with: { client: true, items: true },
  });
  if (!dn) notFound();

  const settings = await getSettings();
  const extraMeta = [
    dn.deliveredBy ? { label: "Delivered by" as const, value: dn.deliveredBy } : null,
    dn.receivedBy ? { label: "Received by" as const, value: dn.receivedBy } : null,
  ].filter((m): m is { label: "Delivered by" | "Received by"; value: string } => m !== null);

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

  return { buffer: Buffer.from(buffer), filename: `${dn.number}.pdf`, title: `Delivery note ${dn.number}` };
}

/** Renders the statement PDF for a client over a date range. */
export async function renderStatementPdf(
  clientId: number,
  fromDate: string,
  toDate: string
): Promise<SharedPDF> {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!client) notFound();

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

  const buffer = await renderStatementPDFBuffer({
    client: { name: client.name, email: client.email, address: client.address },
    fromDate,
    toDate,
    rows: statementRows,
    company: companyFromSettings(settings),
  });

  const clientName = client.name.replace(/\s+/g, "-");
  return {
    buffer: Buffer.from(buffer),
    filename: `statement-${clientName}.pdf`,
    title: `Statement for ${client.name}`,
  };
}