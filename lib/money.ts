export function toNumber(v: string | number | null | undefined) {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(v: string | number | null | undefined, currency = "R") {
  const n = toNumber(v);
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type LineItem = {
  quantity: string | number;
  unitPrice: string | number;
  vatTreatment?: "standard" | "zero_rated" | "exempt" | string | null;
};

export function calcSubtotal(items: LineItem[]) {
  return items.reduce((sum, it) => sum + toNumber(it.quantity) * toNumber(it.unitPrice), 0);
}

export function calcTotals(items: LineItem[], taxRate: string | number, discount: string | number) {
  const subtotal = calcSubtotal(items);
  const discountAmount = Math.min(Math.max(toNumber(discount), 0), subtotal);
  const afterDiscount = subtotal - discountAmount;
  const rate = Math.max(toNumber(taxRate), 0) / 100;
  const taxableAfterDiscount = items.reduce((sum, item) => {
    const lineTotal = Math.max(toNumber(item.quantity) * toNumber(item.unitPrice), 0);
    const discountedLine = subtotal > 0 ? lineTotal * (afterDiscount / subtotal) : 0;
    return sum + (item.vatTreatment === "standard" || !item.vatTreatment ? discountedLine : 0);
  }, 0);
  const tax = taxableAfterDiscount * rate;
  const total = afterDiscount + tax;
  return { subtotal, discount: discountAmount, tax, total };
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "2-digit" });
}
