import { NextRequest } from "next/server";
import { renderReceiptPdf } from "@/lib/document-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let pdf: Awaited<ReturnType<typeof renderReceiptPdf>>;
  try {
    pdf = await renderReceiptPdf(Number((await params).id));
  } catch {
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