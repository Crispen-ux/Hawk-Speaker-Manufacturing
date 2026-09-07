import { PageHeader, Card, Field, inputClass, PrimaryButton, GhostLink } from "@/components/ui";
import JournalLinesEditor from "@/components/JournalLinesEditor";
import { createJournalEntry } from "@/lib/actions/journal";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export default async function NewJournalEntryPage() {
  const settings = await getSettings();
  const accountRows = await db.select().from(accounts).where(eq(accounts.active, true)).orderBy(asc(accounts.code));
  const journalAccounts = accountRows.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="General ledger" title="New journal entry" />
      <Card>
        <form action={createJournalEntry} className="space-y-5">
          <input type="hidden" name="kind" value="manual" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date">
              <input id="date" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
            </Field>
            <Field label="Memo">
              <input id="memo" name="memo" type="text" required placeholder="What is this entry for?" className={inputClass} />
            </Field>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Lines</p>
            <JournalLinesEditor accounts={journalAccounts} currency={settings.currency} />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <PrimaryButton>Post entry</PrimaryButton>
            <GhostLink href="/accounting/journal">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
