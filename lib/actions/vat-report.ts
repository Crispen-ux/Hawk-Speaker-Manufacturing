import { db } from "@/db";
import { invoices, invoiceItems, expenses, payments } from "@/db/schema";
import { and, gte, lte, eq } from "drizzle-orm";

type VatLine = {
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

export async function generateVatReport(
  from: string,
  to: string,
  basis: "accrual" | "cash"
): Promise<VatReport> {
  const lines: VatLine[] = [];

  // --- OUTPUT TAX (invoices) ---
  const invRows = await db.query.invoices.findMany({
    where: and(
      eq(invoices.status, "paid"),
      basis === "accrual"
        ? and(gte(invoices.issueDate, from), lte(invoices.issueDate, to))
        : undefined
    ),
    with: { items: true, payments: true, client: true },
  });

  // For cash basis, filter by payment date
  let relevantInvoices = invRows;
  if (basis === "cash") {
    relevantInvoices = invRows.filter((inv) =>
      inv.payments.some((p) => p.date >= from && p.date <= to)
    );
  }

  for (const inv of relevantInvoices) {
    const taxRate = Number(inv.taxRate) / 100;
    const totalBeforeTax = inv.items.reduce(
      (s, it) => s + Number(it.quantity) * Number(it.unitPrice),
      0
    );
    const discount = Number(inv.discount);
    const net = Math.max(totalBeforeTax - discount, 0);

    // Per-item VAT breakdown
    const hasZeroOrExempt = inv.items.some(
      (it) => it.vatTreatment === "zero_rated" || it.vatTreatment === "exempt"
    );

    if (hasZeroOrExempt) {
      // Mixed items — break down per item
      for (const it of inv.items) {
        const itemNet = Number(it.quantity) * Number(it.unitPrice);
        const treatment = it.vatTreatment || "standard";
        const itemTax =
          treatment === "standard" ? itemNet * taxRate : 0;
        lines.push({
          kind: "Invoice",
          number: inv.number,
          date: inv.issueDate,
          clientOrSupplier: inv.client?.name ?? "",
          netAmount: itemNet,
          taxAmount: itemTax,
          vatTreatment: treatment,
        });
      }
    } else {
      // All standard
      const tax = net * taxRate;
      lines.push({
        kind: "Invoice",
        number: inv.number,
        date: inv.issueDate,
        clientOrSupplier: inv.client?.name ?? "",
        netAmount: net,
        taxAmount: tax,
        vatTreatment: "standard",
      });
    }
  }

  // --- INPUT TAX (expenses) ---
  const expRows = await db.select().from(expenses).where(
    basis === "accrual"
      ? and(gte(expenses.date, from), lte(expenses.date, to))
      : undefined
  );

  // For cash-basis expenses, only include paid expenses (all expenses are treated as paid for now)
  for (const exp of expRows) {
    const net = Number(exp.amount);
    const treatment = exp.vatTreatment || "standard";
    // Simplified: assume standard VAT rate from the first invoice or settings
    // In production you'd use the actual rate from settings
    const taxRate = 0.15; // Default 15% VAT
    const tax = treatment === "standard" ? net * taxRate : 0;
    lines.push({
      kind: "Expense",
      number: exp.reference ?? `EXP-${exp.id}`,
      date: exp.date,
      clientOrSupplier: exp.category ?? "",
      netAmount: net,
      taxAmount: tax,
      vatTreatment: treatment,
    });
  }

  const totalOutputTax = lines
    .filter((l) => l.kind === "Invoice")
    .reduce((s, l) => s + l.taxAmount, 0);
  const totalInputTax = lines
    .filter((l) => l.kind === "Expense")
    .reduce((s, l) => s + l.taxAmount, 0);

  const zeroRatedTotal = lines
    .filter((l) => l.vatTreatment === "zero_rated")
    .reduce((s, l) => s + l.netAmount, 0);
  const exemptTotal = lines
    .filter((l) => l.vatTreatment === "exempt")
    .reduce((s, l) => s + l.netAmount, 0);
  const standardRatedTotal = lines
    .filter((l) => l.vatTreatment === "standard")
    .reduce((s, l) => s + l.netAmount, 0);

  return {
    basis,
    from,
    to,
    lines,
    totalOutputTax,
    totalInputTax,
    vatPayable: totalOutputTax - totalInputTax,
    zeroRatedTotal,
    exemptTotal,
    standardRatedTotal,
  };
}
