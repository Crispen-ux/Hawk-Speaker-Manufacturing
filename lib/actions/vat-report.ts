import { db } from "@/db";
import { expenses } from "@/db/schema";
import { calcTotals, toNumber } from "@/lib/money";

export type VatLine = {
  kind: string;
  number: string;
  date: string;
  clientOrSupplier: string;
  netAmount: number;
  taxAmount: number;
  vatTreatment: string;
};

export type VatReport = {
  basis: "accrual" | "cash";
  from: string;
  to: string;
  lines: VatLine[];
  totalOutputTax: number;
  totalInputTax: number;
  vatPayable: number;
  zeroRatedTotal: number;
  exemptTotal: number;
  standardRatedTotal: number;
};

type VatItem = { quantity: string; unitPrice: string; vatTreatment?: string | null };

type VatDocument = {
  number: string;
  issueDate: string;
  taxRate: string;
  discount: string;
  client?: { name: string } | null;
  items: VatItem[];
};

function signLine(line: VatLine, sign: 1 | -1): VatLine {
  return { ...line, netAmount: line.netAmount * sign, taxAmount: line.taxAmount * sign };
}

function documentVatLines(document: VatDocument, kind: string, sign: 1 | -1 = 1, factor = 1) {
  const subtotal = document.items.reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitPrice), 0);
  const discount = Math.min(Math.max(toNumber(document.discount), 0), subtotal);
  const afterDiscount = subtotal - discount;
  const rate = Math.max(toNumber(document.taxRate), 0) / 100;
  return document.items.map((item) => {
    const raw = Math.max(toNumber(item.quantity) * toNumber(item.unitPrice), 0);
    const net = subtotal > 0 ? raw * (afterDiscount / subtotal) : 0;
    const treatment = item.vatTreatment || "standard";
    const tax = treatment === "standard" ? net * rate : 0;
    return signLine({ kind, number: document.number, date: document.issueDate, clientOrSupplier: document.client?.name ?? "", netAmount: net * factor, taxAmount: tax * factor, vatTreatment: treatment }, sign);
  });
}

export async function generateVatReport(from: string, to: string, basis: "accrual" | "cash"): Promise<VatReport> {
  const lines: VatLine[] = [];
  const invoiceRows = await db.query.invoices.findMany({ with: { items: true, payments: true, client: true } });
  const creditRows = await db.query.creditNotes.findMany({ with: { items: true, client: true } });
  const supplierRows = await db.query.supplierBills.findMany({ with: { items: true, supplier: true } });
  const expenseRows = await db.select().from(expenses);

  for (const invoice of invoiceRows) {
    if (invoice.status === "draft" || invoice.status === "cancelled") continue;
    const totals = calcTotals(invoice.items, invoice.taxRate, invoice.discount);
    if (basis === "accrual") {
      if (invoice.issueDate < from || invoice.issueDate > to || totals.total <= 0) continue;
      lines.push(...documentVatLines(invoice, "Invoice"));
    } else {
      if (totals.total <= 0) continue;
      for (const payment of invoice.payments) {
        if (payment.date < from || payment.date > to) continue;
        const factor = Math.min(Math.max(toNumber(payment.amount) / totals.total, 0), 1);
        lines.push(...documentVatLines({ ...invoice, issueDate: payment.date }, "Receipt", 1, factor));
      }
    }
  }

  for (const note of creditRows) {
    if (note.status === "draft" || note.status === "cancelled" || note.issueDate < from || note.issueDate > to) continue;
    lines.push(...documentVatLines({ number: note.number, issueDate: note.issueDate, taxRate: note.taxRate, discount: note.discount, client: note.client, items: note.items }, "Credit note", -1));
  }

  for (const bill of supplierRows) {
    if (bill.status !== "approved") continue;
    const items = bill.items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitCost, vatTreatment: item.vatTreatment }));
    if (basis === "accrual") {
      if (bill.billDate < from || bill.billDate > to) continue;
      lines.push(...documentVatLines({ number: bill.number, issueDate: bill.billDate, taxRate: bill.taxRate, discount: bill.discount, client: { name: bill.supplier?.name ?? "" }, items }, "Supplier bill"));
    } else if (bill.paid && bill.paidDate && bill.paidDate >= from && bill.paidDate <= to) {
      lines.push(...documentVatLines({ number: bill.number, issueDate: bill.paidDate, taxRate: bill.taxRate, discount: bill.discount, client: { name: bill.supplier?.name ?? "" }, items }, "Supplier payment"));
    }
  }

  // Expenses currently have no stored VAT amount. Do not invent a 15% tax
  // figure; approved expenses remain input-VAT neutral until an explicit VAT
  // amount is captured in the data model.
  if (basis === "accrual") {
    for (const exp of expenseRows) {
      if (exp.status !== "approved" || exp.date < from || exp.date > to) continue;
      lines.push({ kind: "Expense", number: exp.reference ?? `EXP-${exp.id}`, date: exp.date, clientOrSupplier: exp.category ?? "", netAmount: toNumber(exp.amount), taxAmount: 0, vatTreatment: exp.vatTreatment });
    }
  }

  const totalOutputTax = lines.filter((l) => l.kind === "Invoice" || l.kind === "Receipt" || l.kind === "Credit note").reduce((sum, l) => sum + l.taxAmount, 0);
  const totalInputTax = lines.filter((l) => l.kind === "Supplier bill" || l.kind === "Supplier payment").reduce((sum, l) => sum + l.taxAmount, 0);
  return {
    basis, from, to, lines, totalOutputTax, totalInputTax, vatPayable: totalOutputTax - totalInputTax,
    zeroRatedTotal: lines.filter((l) => l.vatTreatment === "zero_rated").reduce((sum, l) => sum + l.netAmount, 0),
    exemptTotal: lines.filter((l) => l.vatTreatment === "exempt").reduce((sum, l) => sum + l.netAmount, 0),
    standardRatedTotal: lines.filter((l) => l.vatTreatment === "standard").reduce((sum, l) => sum + l.netAmount, 0),
  };
}
