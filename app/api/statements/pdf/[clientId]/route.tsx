import { db } from "@/db";
import { clients, invoices } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import StatementPDF from "@/components/pdf/StatementPDF";
import { getSettings } from "@/lib/numbering";
import { toNumber } from "@/lib/money";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? "1970-01-01";
  const to = searchParams.get("to") ?? new Date().toISOString().slice(0, 10);

  const [client] = await db.select().from(clients).where(eq(clients.id, Number(clientId)));
  if (!client) return new Response("Not found", { status: 404 });

  const settings = await getSettings();

  const rows = await db.query.invoices.findMany({
    where: and(
      eq(invoices.clientId, Number(clientId)),
      gte(invoices.issueDate, from),
      lte(invoices.issueDate, to)
    ),
    with: { payments: true, items: true },
    orderBy: (invoices, { asc }) => [asc(invoices.issueDate)],
  });

  const statementRows = rows.map((inv) => {
    const subtotal = inv.items.reduce((s, it) => s + toNumber(it.quantity) * toNumber(it.unitPrice), 0);
    const afterDiscount = Math.max(subtotal - toNumber(inv.discount), 0);
    const tax = afterDiscount * (toNumber(inv.taxRate) / 100);
    const total = afterDiscount + tax;
    const paid = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
    return { date: inv.issueDate, number: inv.number, status: inv.status, total, paid };
  });

  const buffer = await renderToBuffer(
    <StatementPDF
      client={{ name: client.name, email: client.email, address: client.address }}
      fromDate={from}
      toDate={to}
      rows={statementRows}
      company={{
        companyName: settings.companyName,
        email: settings.email,
        phone: settings.phone,
        address: settings.address,
      }}
    />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="statement-${client.name.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
