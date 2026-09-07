import { db } from "@/db";
import { creditNotes, expenses, invoices, supplierBills } from "@/db/schema";
import { and, gte, lte, eq } from "drizzle-orm";
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

function signLine(line: VatLine, sign: 1 | -1): VatLine {
  return { ...line, netAmount: line.netAmount * sign, taxAmount: line.taxAmount * sign };
}

function invoiceVatLines(invoice: { number: string; issueDate: string; taxRate: string; discount: string; client?: { name: string } | null; items: Array<{ quantity: string; unitPrice: string; vatTreatment: string }> }, sign: 1 | -1 = 1, factor = 1) {
  const subtotal = invoice.items.reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitPrice), 0);
  const discount = Math.min(Math.max(toNumber(invoice.discount), 0), subtotal);
  const afterDiscount = subtotal - discount;
  const rate = Math.max(toNumber(invoice.taxRate), 0) / 100;
  return invoice.items.map((item) => {
    const raw = Math.max(toNumber(item.quantity) * toNumber(item.unitPrice), 0);
    const net = subtotal > 0 ? raw * (afterDiscount / subtotal) : 0;
    const tax = item.vatTreatment === "standard" ? net * rate : 0;
    return signLine({ kind: sign < 0 ? "Credit note" : "Invoice", number: invoice.number, date: invoice.issueDate, clientOrSupplier: invoice.client?.name ?? "", netAmount: net * factor, taxAmount: tax * factor, vatTreatment: item.vatTreatment || "standard" }, sign);
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
    if (basis === "accrual") {
      if (invoice.issueDate < from || invoice.issueDate > to) continue;
      lines.push(...invoiceVatLines(invoice));
    } else {
      const total = calcTotals(invoice.items, invoice.taxRate, invoice.discount).total;
      const tax = calcTotals(invoice.items, invoice.taxRate, invoice.discount).tax;
      if (total <= 0) continue;
      for (const payment of invoice.payments) {
        if (payment.date < from || payment.date > to) continue;
        const factor = Math.min(Math.max(toNumber(payment.amount) / total, 0), 1);
        lines.push(...invoiceVatLines(invoice, 1, factor).map((line) => ({ ...line, date: payment.date, kind: "Receipt" })));
        void tax;
      }
    }
  }

  for (const note of creditRows) {
    if (note.status === "draft" || note.status === "cancelled") continue;
    if (note.issueDate < from || note.issueDate > to) continue;
    lines.push(...invoiceVatLines({ ...note, client: note.client, items: note.items }, -1));
  }

  for (const bill of supplierRows) {
    if (bill.status !== "approved") continue;
    if (basis === "accrual") {
      if (bill.billDate < from || bill.billDate > to) continue;
      const total = calcTotals(bill.items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitCost, vatTreatment: item.vatTreatment })), bill.taxRate, bill.discount);
      const pseudo = { number: bill.number, issueDate: bill.billDate, taxRate: bill.taxRate, discount: bill.discount, client: { name: bill.supplier?.name ?? "" }, items: bill.items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitCost, vatTreatment: item.vatTreatment })) };
      const detail = invoiceVatLines(pseudo).map((line) => ({ ...line, kind: "Supplier bill" }));
      lines.push(...detail);
      void total;
    } else if (bill.paid && bill.paidDate && bill.paidDate >= from && bill.paidDate <= to) {
      const detail = invoiceVatLines({ number: bill.number, issueDate: bill.paidDate, taxRate: bill.taxRate, discount: bill.discount, client: { name: bill.supplier?.name ?? "" }, items: bill.items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitCost, vatTreatment: item.vatTreatment })) }).map((line) => ({ ...line, kind: "Supplier payment" }));
      lines.push(...detail);
    }
  }

  // Expenses currently have no stored VAT amount, so do not invent 15% input
  // tax. They contribute only when an explicit VAT field is added to the model.
  for (const exp of expenseRows) {
    if (exp.status !== "approved") continue;
    if (basis === "accrual" && (exp.date < from || exp.date > to)) continue;
    if (basis === "cash") continue;
    lines.push({ kind: "Expense", number: exp.reference ?? `EXP-${exp.id}`, date: exp.date, clientOrSupplier: exp.category ?? "", netAmount: toNumber(exp.amount), taxAmount: 0, vatTreatment: exp.vatTreatment });
  }

  const totalOutputTax = lines.filter((l) => l.kind === "Invoice" || l.kind === "Receipt" || l.kind === "Credit note").reduce((sum, l) => sum + l.taxAmount, 0);
  const totalInputTax = lines.filter((l) => l.kind === "Supplier bill" || l.kind === "Supplier payment").reduce((sum, l) => sum + l.taxAmount, 0);
  return {
    basis, from, to, lines,
    totalOutputTax,
    totalInputTax,
    vatPayable: totalOutputTax - totalInputTax,
    zeroRatedTotal: lines.filter((l) => l.vatTreatment === "zero_rated").reduce((sum, l) => sum + l.netAmount, 0),
    exemptTotal: lines.filter((l) => l.vatTreatment === "exempt").reduce((sum, l) => sum + l.netAmount, 0),
    standardRatedTotal: lines.filter((l) => l.vatTreatment === "standard").reduce((sum, l) => sum + l.netAmount, 0),
  };
}
