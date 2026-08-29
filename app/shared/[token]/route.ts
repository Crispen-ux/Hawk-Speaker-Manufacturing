import { NextRequest } from "next/server";
import { resolveDocumentLink } from "@/lib/public-links";
import { renderInvoicePdf, renderQuotationPdf, renderStatementPdf, renderDeliveryNotePdf } from "@/lib/document-pdf";
import type { SharedPDF } from "@/lib/document-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function pdfFor(meta: Awaited<ReturnType<typeof resolveDocumentLink>>): Promise<SharedPDF | null> {
  if (!meta) return null;
  switch (meta.kind) {
    case "invoice":
      return renderInvoicePdf(meta.documentId);
    case "quotation":
      return renderQuotationPdf(meta.documentId);
    case "deliveryNote":
      return renderDeliveryNotePdf(meta.documentId);
    case "statement":
      return renderStatementPdf(meta.clientId, meta.fromDate, meta.toDate);
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let pdf: SharedPDF | null;
  try {
    pdf = await pdfFor(await resolveDocumentLink(token));
  } catch {
    pdf = null;
  }
  if (!pdf) {
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  }

  return new Response(new Uint8Array(pdf.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdf.filename}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}