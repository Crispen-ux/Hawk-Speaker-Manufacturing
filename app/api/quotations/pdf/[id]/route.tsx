import { db } from "@/db";
import { quotations } from "@/db/schema";
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
  const quotation = await db.query.quotations.findFirst({
    where: eq(quotations.id, Number(id)),
    with: { client: true, items: true },
  });
  if (!quotation) return new Response("Not found", { status: 404 });

  const settings = await getSettings();

  const buffer = await renderToBuffer(
    <DocPDF
      kind="Quotation"
      number={quotation.number}
      status={quotation.status}
      issueDate={quotation.issueDate}
      dueOrExpiryLabel="Valid until"
      dueOrExpiryDate={quotation.expiryDate}
      client={{
        name: quotation.client?.name ?? "",
        email: quotation.client?.email,
        address: quotation.client?.address,
      }}
      items={quotation.items}
      taxRate={quotation.taxRate}
      discount={quotation.discount}
      notes={quotation.notes}
      company={companyFromSettings(settings)}
    />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quotation.number}.pdf"`,
    },
  });
}
