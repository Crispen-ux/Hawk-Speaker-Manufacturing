import { generateVatReport } from "@/lib/actions/vat-report";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);
  const basis = (searchParams.get("basis") as "accrual" | "cash") || "accrual";

  const report = await generateVatReport(from, to, basis);

  const header = "Type,Number,Date,Client/Category,VAT Treatment,Net Amount,Tax Amount";
  const rows = report.lines.map(
    (l) => `"${l.kind}","${l.number}","${l.date}","${l.clientOrSupplier}","${l.vatTreatment}",${l.netAmount.toFixed(2)},${l.taxAmount.toFixed(2)}`
  );
  const summary = [
    "",
    `"Output Tax",,,,"",,${report.totalOutputTax.toFixed(2)}`,
    `"Input Tax",,,,"",,${report.totalInputTax.toFixed(2)}`,
    `"VAT Payable",,,,"",,${report.vatPayable.toFixed(2)}`,
    `"Zero-Rated Total",,,,,"${report.zeroRatedTotal.toFixed(2)}",`,
    `"Exempt Total",,,,,"${report.exemptTotal.toFixed(2)}",`,
    `"Standard Rated Total",,,,,"${report.standardRatedTotal.toFixed(2)}",`,
  ];

  const csv = [header, ...rows, ...summary].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="vat-report-${from}-to-${to}.csv"`,
    },
  });
}
