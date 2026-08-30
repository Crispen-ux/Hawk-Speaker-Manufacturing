import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { journalEntries } from "@/db/schema";
import { deleteJournalEntry } from "@/lib/actions/journal";
import { formatDate, formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { PageHeader, GhostLink, Card } from "@/components/ui";
import ConfirmForm from "@/components/ConfirmForm";

export const dynamic = "force-dynamic";

export default async function JournalEntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entryId = Number(id);
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const [entry] = await db.query.journalEntries.findMany({
    where: eq(journalEntries.id, entryId),
    with: { lines: { with: { account: true } } },
  });
  if (!entry) notFound();

  const debits = entry.lines
    .filter((l) => Number(l.debit || 0) > 0)
    .map((l) => ({ line: l, amount: Number(l.debit || 0) }));
  const credits = entry.lines
    .filter((l) => Number(l.credit || 0) > 0)
    .map((l) => ({ line: l, amount: Number(l.credit || 0) }));
  const remove = deleteJournalEntry.bind(null, entryId);

  return (
    <div>
      <PageHeader
        eyebrow="General ledger"
        title={`${entry.number} · ${entry.memo}`}
        action={
          <div className="flex items-center gap-2">
            <GhostLink href={`/accounting/journal/${entryId}/edit`}>Edit</GhostLink>
          </div>
        }
      />

      <p className="mb-5 -mt-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">
        {entry.kind === "opening" ? "Opening balance" : "Manual entry"} · {formatDate(entry.date)}
        {entry.reference ? ` · ${entry.reference}` : ""}
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule bg-paper-dim font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                  <th className="px-4 py-2.5 text-left font-medium">Account</th>
                  <th className="px-4 py-2.5 text-left font-medium">Memo</th>
                  <th className="px-4 py-2.5 text-right font-medium">Debit</th>
                  <th className="px-4 py-2.5 text-right font-medium">Credit</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((l) => (
                  <tr key={l.id} className="border-b border-rule last:border-b-0">
                    <td className="px-4 py-2.5">
                      <span className="mr-3 inline-block w-12 font-mono text-ink-soft">{l.account?.code}</span>
                      <span className="font-medium text-ink">{l.account?.name ?? "Unknown account"}</span>
                      {l.account?.isSystem && (
                        <span className="ml-2 rounded bg-paper-dim px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-ink-soft">
                          auto
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{l.memo || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{money(l.debit)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{money(l.credit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-navy bg-navy text-paper">
                  <td colSpan={2} className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em]">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {money(debits.reduce((s, d) => s + d.amount, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {money(credits.reduce((s, c) => s + c.amount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Entry lines</div>
            <div className="mt-2 text-ink">
              <span className="text-2xl font-semibold">{money(debits.reduce((s, d) => s + d.amount, 0))}</span>
              <span className="mx-2 text-ink-soft">=</span>
              {debits.length} debit{debits.length === 1 ? "" : "s"}
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              {debtsMatchCredits(debits, credits)
                ? "This entry is balanced and is posted to the ledger."
                : "This entry does not balance and should be fixed."}
            </p>
          </Card>
          <Card>
            <p className="mb-2 text-sm text-ink">
              This entry was posted to the{" "}
              <a href="/accounting/trial-balance" className="text-forest hover:underline">
                trial balance
              </a>{" "}
              as of its date.
            </p>
          </Card>
          <ConfirmForm action={remove} confirm="Delete this journal entry? This can't be undone.">
            <button className="w-full font-mono text-xs uppercase tracking-wide text-rust hover:underline">
              Delete entry
            </button>
          </ConfirmForm>
        </div>
      </div>
    </div>
  );
}

function debtsMatchCredits(
  debits: { amount: number }[],
  credits: { amount: number }[]
) {
  const d = debits.reduce((s, x) => s + x.amount, 0);
  const c = credits.reduce((s, x) => s + x.amount, 0);
  return Math.abs(d - c) < 0.01;
}