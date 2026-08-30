import { getBalanceSheet } from "@/lib/ledger";
import { renderToBuffer } from "@react-pdf/renderer";
import { BalanceSheetPDF } from "@/components/pdf/AccountingPDF";
import { getSettings } from "@/lib/numbering";
import { companyFromSettings } from "@/lib/company";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const asOf = new URL(req.url).searchParams.get("asOf") ?? new Date().toISOString().slice(0, 10);

  const [bs, settings] = await Promise.all([getBalanceSheet(asOf), getSettings()]);

  const buffer = await renderToBuffer(
    <BalanceSheetPDF
      asOf={asOf}
      bs={bs}
      company={companyFromSettings(settings)}
      currency={settings.currency}
    />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="balance-sheet-${asOf}.pdf"`,
    },
  });
}