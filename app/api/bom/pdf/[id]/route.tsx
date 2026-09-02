import { db } from "@/db";
import { bomHeaders, bomItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import BomPDF from "@/components/pdf/BomPDF";
import { getSettings } from "@/lib/numbering";
import { companyFromSettings } from "@/lib/company";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bomId = Number(id);
  const [header] = await db.select().from(bomHeaders).where(eq(bomHeaders.id, bomId));
  if (!header) return new Response("Not found", { status: 404 });

  const settings = await getSettings();
  const items = await db.select().from(bomItems).where(eq(bomItems.bomId, bomId)).orderBy(bomItems.sortOrder);

  const buffer = await renderToBuffer(
    <BomPDF
      name={header.name}
      createdAt={header.createdAt}
      description={header.description}
      items={items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitCost: it.unitCost,
        markup: it.markup,
        vatTreatment: it.vatTreatment,
      }))}
      company={companyFromSettings(settings)}
      currency={settings.currency}
    />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="bom-${header.id}.pdf"`,
    },
  });
}
