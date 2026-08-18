import { db } from "@/db";
import { invoices, quotations, clients } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getSettings } from "@/lib/numbering";
import { renderDocPDFBuffer, renderStatementPDFBuffer } from "@/lib/pdf-render";
import { sendEmail } from "@/lib/email";
import { calcTotals, formatMoney, toNumber } from "@/lib/money";

function emailBody({
  greeting,
  message,
  companyName,
}: {
  greeting: string;
  message?: string;
  companyName: string;
}) {
  const body = message
    ? message.trim().replace(/\n/g, "<br/>")
    : greeting;
  return `<div style="font-family: sans-serif; font-size: 14px; color: #1c2b2e; line-height: 1.6;">
    <p>${body}</p>
    <p style="color:#4a5a5c;">Thank you,<br/>${companyName}</p>
  </div>`;
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

  await sendEmail({
    to,
    subject: `Invoice ${invoice.number} from ${settings.companyName}`,
    html: emailBody({
      greeting: `Please find attached invoice ${invoice.number} for ${formatMoney(total)}, due ${invoice.dueDate}.`,
      message,
      companyName: settings.companyName,
    }),
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

  await sendEmail({
    to,
    subject: `Quotation ${quotation.number} from ${settings.companyName}`,
    html: emailBody({
      greeting: `Please find attached quotation ${quotation.number} for ${formatMoney(total)}, valid until ${quotation.expiryDate}.`,
      message,
      companyName: settings.companyName,
    }),
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

  await sendEmail({
    to,
    subject: `Statement of account from ${settings.companyName}`,
    html: `<div style="font-family: sans-serif; font-size: 14px; color: #1c2b2e; line-height: 1.6;">
      <p>${
        message
          ? message.trim().replace(/\n/g, "<br/>")
          : `Please find attached your statement of account for ${fromDate} to ${toDate}. Outstanding balance: ${formatMoney(outstanding)}.`
      }</p>
      <p style="color:#4a5a5c;">Thank you,<br/>${settings.companyName}</p>
    </div>`,
    attachments: [
      { filename: `statement-${client.name.replace(/\s+/g, "-")}.pdf`, content: buffer.toString("base64") },
    ],
  });
}
