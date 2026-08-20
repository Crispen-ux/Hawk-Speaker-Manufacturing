import { db } from "@/db";
import { deliveryNotes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import DocPDF from "@/components/pdf/DocPDF";
import { getSettings } from "@/lib/numbering";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dn = await db.query.deliveryNotes.findFirst({
    where: eq(deliveryNotes.id, Number(id)),
    with: { client: true, items: true },
  });
  if (!dn) return new Response("Not found", { status: 404 });

  const settings = await getSettings();

  const extraMeta = [
    dn.deliveredBy ? { label: "Delivered by", value: dn.deliveredBy } : null,
    dn.receivedBy ? { label: "Received by", value: dn.receivedBy } : null,
  ].filter((m): m is { label: string; value: string } => m !== null);

  const buffer = await renderToBuffer(
    <DocPDF
      kind="Delivery Note"
      number={dn.number}
      status={dn.status}
      issueDate={dn.deliveryDate}
      dueOrExpiryLabel=""
      dueOrExpiryDate=""
      partyLabel="Delivered to"
      client={{
        name: dn.client?.name ?? "",
        email: dn.client?.email,
        address: dn.client?.address,
      }}
      extraMeta={extraMeta}
      items={dn.items.map((it) => ({ description: it.description, quantity: it.quantity, unitPrice: "0" }))}
      taxRate="0"
      discount="0"
      notes={dn.notes}
      showPricing={false}
      company={{
        companyName: settings.companyName,
        email: settings.email,
        phone: settings.phone,
        address: settings.address,
        bankDetails: settings.bankDetails,
        logoData: settings.logoData,
      }}
    />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${dn.number}.pdf"`,
    },
  });
}
