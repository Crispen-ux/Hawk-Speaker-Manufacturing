import { NextRequest } from "next/server";
import { db } from "@/db";
import { calcTotals, toNumber } from "@/lib/money";

export const dynamic = "force-dynamic";

const KINDS = ["invoices", "payments", "expenses"] as const;

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  const kind = (await params).kind as (typeof KINDS)[number];
  if (!KINDS.includes(kind)) {
    return new Response("Unknown export", { status: 404, headers: { "Content-Type": "text/plain" } });
  }

  let csv = "";
  if (kind === "invoices") {
    const rows = await db.query.invoices.findMany({ with: { client: true, items: true, payments: true } });
    csv = [
      ["Number", "Client", "Issue date", "Due date", "Status", "Total", "Paid", "Balance", "Tax rate", "Discount"].join(","),
      ...rows.map((inv) => {
        const { total } = calcTotals(inv.items, inv.taxRate, inv.discount);
        const paid = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
        return [
          csvCell(inv.number),
          csvCell(inv.client?.name),
          csvCell(inv.issueDate),
          csvCell(inv.dueDate),
          csvCell(inv.status),
          csvCell(total.toFixed(2)),
          csvCell(paid.toFixed(2)),
          csvCell(Math.max(total - paid, 0).toFixed(2)),
          csvCell(inv.taxRate),
          csvCell(inv.discount),
        ].join(",");
      }),
    ].join("\n");
  } else if (kind === "payments") {
    const rows = await db.query.payments.findMany({ with: { invoice: { with: { client: true } } } });
    csv = [
      ["Date", "Invoice", "Client", "Method", "Amount", "Note"].join(","),
      ...rows.map((p) =>
        [
          csvCell(p.date),
          csvCell(p.invoice?.number),
          csvCell(p.invoice?.client?.name),
          csvCell(p.method),
          csvCell(Number(p.amount).toFixed(2)),
          csvCell(p.note),
        ].join(",")
      ),
    ].join("\n");
  } else {
    const rows = await db.query.expenses.findMany({ with: { supplier: true } });
    csv = [
      ["Date", "Description", "Category", "Supplier", "Payment method", "Reference", "Amount", "Notes"].join(","),
      ...rows.map((e) =>
        [
          csvCell(e.date),
          csvCell(e.description),
          csvCell(e.category),
          csvCell(e.supplier?.name),
          csvCell(e.paymentMethod),
          csvCell(e.reference),
          csvCell(Number(e.amount).toFixed(2)),
          csvCell(e.notes),
        ].join(",")
      ),
    ].join("\n");
  }

  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-${todayStamp()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}