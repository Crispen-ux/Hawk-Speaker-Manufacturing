import { db } from "@/db";
import { supplierBills } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader, GhostLink, Card } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import StatusStamp from "@/components/StatusStamp";
import ConfirmForm from "@/components/ConfirmForm";
import {
  setSupplierBillStatus,
  markSupplierBillPaid,
  deleteSupplierBill,
} from "@/lib/actions/supplier-bills";

export const dynamic = "force-dynamic";

const VAT_LABELS: Record<string, string> = {
  standard: "Std",
  zero_rated: "0%",
  exempt: "Exempt",
};

export default async function SupplierBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const billId = Number(id);
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const bill = await db.query.supplierBills.findFirst({
    where: eq(supplierBills.id, billId),
    with: { supplier: true, items: true, approvedBy: true },
  });
  if (!bill) notFound();

  const remove = deleteSupplierBill.bind(null, billId);
  const approve = setSupplierBillStatus.bind(null, billId, "approved");
  const reject = setSupplierBillStatus.bind(null, billId, "rejected");
  const submitStatus = setSupplierBillStatus.bind(null, billId, "submitted");
  const togglePaid = markSupplierBillPaid.bind(null, billId, !bill.paid);

  const subtotal = bill.items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitCost), 0);
  const tax = subtotal * (Number(bill.taxRate) / 100);
  const afterDiscount = Math.max(subtotal - Number(bill.discount), 0);
  const total = afterDiscount + tax;

  return (
    <div>
      <PageHeader
        eyebrow="Purchasing"
        title={bill.number}
        action={
          <div className="flex items-center gap-2">
            {bill.status === "submitted" && (
              <>
                <form action={approve}>
                  <button type="submit" className="rounded-md bg-forest px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-2">Approve</button>
                </form>
                <form action={reject}>
                  <button type="submit" className="rounded-md border border-rust px-3 py-1.5 text-xs font-medium text-rust hover:bg-red-50">Reject</button>
                </form>
              </>
            )}
            {bill.status === "approved" && (
              <form action={submitStatus}>
                <button type="submit" className="rounded-md border border-rule px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-paper-dim">Revoke approval</button>
              </form>
            )}
            <form action={togglePaid}>
              <button type="submit" className={`rounded-md border px-3 py-1.5 text-xs font-medium ${bill.paid ? "border-success text-success" : "border-rule text-ink-soft hover:bg-paper-dim"}`}>
                {bill.paid ? "Mark unpaid" : "Mark paid"}
              </button>
            </form>
            <GhostLink href={`/supplier-bills/${billId}/edit`}>Edit</GhostLink>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusStamp status={bill.status} />
        {bill.paid && <StatusStamp status="paid" />}
      </div>

      <div className="grid max-w-3xl gap-6 lg:grid-cols-[1fr_260px]">
        <Card className="max-w-full">
          <div className="mb-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">Supplier</span>
              <span className="font-medium">{bill.supplier?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">Description</span>
              <span>{bill.description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">Bill date</span>
              <span className="font-mono">{formatDate(bill.billDate)}</span>
            </div>
            {bill.dueDate && (
              <div className="flex justify-between">
                <span className="text-ink-soft">Due date</span>
                <span className="font-mono">{formatDate(bill.dueDate)}</span>
              </div>
            )}
            {bill.approvedBy && (
              <div className="flex justify-between">
                <span className="text-ink-soft">Approved by</span>
                <span>{bill.approvedBy.name ?? bill.approvedBy.email}</span>
              </div>
            )}
            {bill.approvedAt && (
              <div className="flex justify-between">
                <span className="text-ink-soft">Approved at</span>
                <span className="font-mono">{formatDate(bill.approvedAt)}</span>
              </div>
            )}
            {bill.paid && bill.paidDate && (
              <div className="flex justify-between">
                <span className="text-ink-soft">Paid date</span>
                <span className="font-mono">{formatDate(bill.paidDate)}</span>
              </div>
            )}
          </div>

          {bill.notes && (
            <div className="mb-4 rounded-md bg-paper-dim p-3 text-sm text-ink-soft">
              {bill.notes}
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-rule">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-4 py-2.5 text-right font-medium">Unit cost</th>
                  <th className="px-4 py-2.5 font-medium">VAT</th>
                  <th className="px-4 py-2.5 text-right font-medium">Line</th>
                </tr>
              </thead>
              <tbody>
                {bill.items.map((it) => (
                  <tr key={it.id} className="border-b border-rule last:border-b-0">
                    <td className="px-4 py-3">{it.description}</td>
                    <td className="px-4 py-3 text-right font-mono">{Number(it.quantity)}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(it.unitCost)}</td>
                    <td className="px-4 py-3 text-xs text-ink-soft">{VAT_LABELS[it.vatTreatment] ?? it.vatTreatment}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(Number(it.quantity) * Number(it.unitCost))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">Subtotal</span>
              <span className="font-mono">{money(subtotal)}</span>
            </div>
            {Number(bill.discount) > 0 && (
              <div className="flex justify-between">
                <span className="text-ink-soft">Discount</span>
                <span className="font-mono">-{money(bill.discount)}</span>
              </div>
            )}
            {Number(bill.taxRate) > 0 && (
              <div className="flex justify-between">
                <span className="text-ink-soft">Tax ({Number(bill.taxRate)}%)</span>
                <span className="font-mono">{money(tax)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-rule pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="font-mono">{money(total)}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 max-w-3xl">
        <ConfirmForm action={remove} confirm="Delete this supplier bill?">
          <button type="submit" className="font-mono text-xs uppercase tracking-wide text-rust hover:underline">
            Delete supplier bill
          </button>
        </ConfirmForm>
      </div>
    </div>
  );
}
