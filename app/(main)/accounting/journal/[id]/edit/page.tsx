import { notFound } from "next/navigation";
import { PageHeader, Card, Field, inputClass, PrimaryButton, GhostLink } from "@/components/ui";
import JournalLinesEditor from "@/components/JournalLinesEditor";
import { updateJournalEntry } from "@/lib/actions/journal";
import { db } from "@/db";
import { journalEntries, accounts } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getSettings } from "@/lib/numbering";
import type { JournalLine } from "@/components/JournalLinesEditor";

export const dynamic = "force-dynamic";

export default async function EditJournalEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entryId = Number(id);
  const settings = await getSettings();
  const accountRows = await db.select().from(accounts).orderBy(asc(accounts.code));
  const journalAccounts = accountRows.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
  }));

  const [entry] = await db.query.journalEntries.findMany({
    where: eq(journalEntries.id, entryId),
    with: { lines: true },
  });
  if (!entry) notFound();

  const initialLines: JournalLine[] = entry.lines.map((l) => ({
    accountId: String(l.accountId),
    debit: Number(l.debit || 0) > 0 ? String(Number(l.debit || 0)) : "",
    credit: Number(l.credit || 0) > 0 ? String(Number(l.credit || 0)) : "",
    memo: l.memo ?? "",
  }));

  const save = updateJournalEntry.bind(null, entryId);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="General ledger"
        title={`Edit ${entry.number}`}
      />
      <Card>
        <form action={save} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date">
              <input
                id="date"
                name="date"
                type="date"
                required
                defaultValue={entry.date}
                className={inputClass}
              />
            </Field>
            <Field label="Kind">
              <select id="kind" name="kind" defaultValue={entry.kind} className={inputClass}>
                <option value="manual">Manual</option>
                <option value="opening">Opening balance</option>
              </select>
            </Field>
            <Field label="Reference (optional)">
              <input
                id="reference"
                name="reference"
                type="text"
                defaultValue={entry.reference ?? ""}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Memo">
            <input id="memo" name="memo" type="text" required defaultValue={entry.memo} className={inputClass} />
          </Field>

          <div>
            <p className="mb-2 text-sm font-medium text-ink">Lines</p>
            <JournalLinesEditor accounts={journalAccounts} initialLines={initialLines} currency={settings.currency} />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <PrimaryButton>Save changes</PrimaryButton>
            <GhostLink href={`/accounting/journal/${entryId}`}>Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}