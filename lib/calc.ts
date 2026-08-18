import { calcTotals, toNumber } from "@/lib/money";

type Item = { quantity: string; unitPrice: string };
type Payment = { amount: string };

export function computeInvoice(
  invoice: { taxRate: string; discount: string; status: string; dueDate: string },
  items: Item[],
  paymentsList: Payment[] = []
) {
  const { subtotal, discount, tax, total } = calcTotals(items, invoice.taxRate, invoice.discount);
  const paid = paymentsList.reduce((s, p) => s + toNumber(p.amount), 0);
  const balance = Math.max(total - paid, 0);

  let effectiveStatus = invoice.status;
  if (invoice.status !== "cancelled") {
    if (balance <= 0 && total > 0) {
      effectiveStatus = "paid";
    } else if (paid > 0 && balance > 0) {
      effectiveStatus = "partial";
    } else if (invoice.status !== "draft") {
      const isOverdue = new Date(invoice.dueDate) < new Date(new Date().toDateString());
      effectiveStatus = isOverdue ? "overdue" : invoice.status === "partial" ? "sent" : invoice.status;
    }
  }

  return { subtotal, discount, tax, total, paid, balance, effectiveStatus };
}

export function computeQuotation(
  quotation: { taxRate: string; discount: string },
  items: Item[]
) {
  return calcTotals(items, quotation.taxRate, quotation.discount);
}
