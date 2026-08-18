export function toNumber(v: string | number | null | undefined) {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(v: string | number | null | undefined, currency = "R") {
  const n = toNumber(v);
  return `${currency} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export type LineItem = { quantity: string | number; unitPrice: string | number };

export function calcSubtotal(items: LineItem[]) {
  return items.reduce((sum, it) => sum + toNumber(it.quantity) * toNumber(it.unitPrice), 0);
}

export function calcTotals(items: LineItem[], taxRate: string | number, discount: string | number) {
  const subtotal = calcSubtotal(items);
  const afterDiscount = Math.max(subtotal - toNumber(discount), 0);
  const tax = afterDiscount * (toNumber(taxRate) / 100);
  const total = afterDiscount + tax;
  return { subtotal, discount: toNumber(discount), tax, total };
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "2-digit" });
}
