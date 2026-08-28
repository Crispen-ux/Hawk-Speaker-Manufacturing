import { db } from "@/db";
import { jobCards } from "@/db/schema";
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
  const job = await db.query.jobCards.findFirst({
    where: eq(jobCards.id, Number(id)),
    with: { client: true, items: true },
  });
  if (!job) return new Response("Not found", { status: 404 });

  const settings = await getSettings();

  const extraMeta = [
    job.technician ? { label: "Technician", value: job.technician } : null,
    job.equipment ? { label: "Equipment / asset", value: job.equipment } : null,
  ].filter((m): m is { label: string; value: string } => m !== null);

  const buffer = await renderToBuffer(
    <DocPDF
      kind="Job Card"
      number={job.number}
      status={job.status}
      issueDate={job.openedDate}
      dueOrExpiryLabel="Completed"
      dueOrExpiryDate={job.completedDate ?? ""}
      partyLabel="Client"
      client={{
        name: job.client?.name ?? "",
        email: job.client?.email,
        address: job.client?.address,
      }}
      extraMeta={extraMeta}
      items={job.items}
      taxRate={job.taxRate}
      discount={job.discount}
      notes={[job.title, job.description, job.notes].filter(Boolean).join("\n\n")}
      showPricing={job.items.length > 0}
      company={companyFromSettings(settings)}
    />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${job.number}.pdf"`,
    },
  });
}
