import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import DocPDF from "@/components/pdf/DocPDF";
import { getSettings } from "@/lib/numbering";
import { companyFromSettings } from "@/lib/company";
import { toNumber } from "@/lib/money";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, Number(id)),
    with: { client: true, items: true, payments: true },
  });
  if (!invoice) return new Response("Not found", { status: 404 });

  const settings = await getSettings();
  const paid = invoice.payments.reduce((s, p) => s + toNumber(p.amount), 0);

  const buffer = await renderToBuffer(
    <DocPDF
      kind="Invoice"
      number={invoice.number}
      status={invoice.status}
      issueDate={invoice.issueDate}
      dueOrExpiryLabel="Due"
      dueOrExpiryDate={invoice.dueDate}
      client={{
        name: invoice.client?.name ?? "",
        email: invoice.client?.email,
        address: invoice.client?.address,
      }}
      items={invoice.items}
      taxRate={invoice.taxRate}
      discount={invoice.discount}
      notes={invoice.notes}
      paid={paid}
      company={companyFromSettings(settings)}
    />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
    },
  });
}
