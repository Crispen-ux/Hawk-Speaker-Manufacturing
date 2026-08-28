import { db } from "@/db";
import { purchaseOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import DocPDF from "@/components/pdf/DocPDF";
import { getSettings } from "@/lib/numbering";
import { companyFromSettings } from "@/lib/company";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const po = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, Number(id)),
    with: { supplier: true, items: true },
  });
  if (!po) return new Response("Not found", { status: 404 });

  const settings = await getSettings();

  const buffer = await renderToBuffer(
    <DocPDF
      kind="Purchase Order"
      number={po.number}
      status={po.status}
      issueDate={po.issueDate}
      dueOrExpiryLabel="Expected delivery"
      dueOrExpiryDate={po.expectedDate ?? ""}
      partyLabel="Supplier"
      client={{
        name: po.supplier?.name ?? "",
        email: po.supplier?.email,
        address: po.supplier?.address,
      }}
      items={po.items}
      taxRate={po.taxRate}
      discount={po.discount}
      notes={po.notes}
      company={companyFromSettings(settings)}
    />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${po.number}.pdf"`,
    },
  });
}
