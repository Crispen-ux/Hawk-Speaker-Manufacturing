import { db } from "@/db";
import { journalEntries } from "@/db/schema";
import { desc } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { JournalPDF } from "@/components/pdf/AccountingPDF";
import type { JournalEntryPdf } from "@/components/pdf/AccountingPDF";
import { getSettings } from "@/lib/numbering";
import { companyFromSettings } from "@/lib/company";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [settings, entries] = await Promise.all([
    getSettings(),
    db.query.journalEntries.findMany({
      with: { lines: { with: { account: true } } },
      orderBy: [desc(journalEntries.date), desc(journalEntries.id)],
    }),
  ]);

  const mapped: JournalEntryPdf[] = entries.map((e) => ({
    number: e.number,
    date: e.date,
    kind: e.kind,
    memo: e.memo,
    reference: e.reference,
    lines: e.lines.map((l) => ({
      accountCode: l.account.code,
      accountName: l.account.name,
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0),
    })),
  }));

  const totalDebits = entries.reduce(
    (s, e) => s + e.lines.reduce((t, l) => t + Number(l.debit || 0), 0),
    0
  );
  const totalCredits = entries.reduce(
    (s, e) => s + e.lines.reduce((t, l) => t + Number(l.credit || 0), 0),
    0
  );

  const buffer = await renderToBuffer(
    <JournalPDF
      asOf={new Date().toISOString().slice(0, 10)}
      entries={mapped}
      totalDebits={totalDebits}
      totalCredits={totalCredits}
      company={companyFromSettings(settings)}
      currency={settings.currency}
    />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="general-journal.pdf"`,
    },
  });
}