import { db } from "@/db";
import Link from "next/link";
import { PageHeader, LinkButton, EmptyState, Card } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/money";
import { calcTotals } from "@/lib/money";
import { toggleRecurringActive } from "@/lib/actions/recurring";

export const dynamic = "force-dynamic";

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export default async function RecurringPage() {
  const rows = await db.query.recurringInvoices.findMany({
    with: { client: true, items: true },
    orderBy: (recurringInvoices, { asc }) => [asc(recurringInvoices.nextRunDate)],
  });

  return (
    <div>
      <PageHeader
        eyebrow="Recurring income"
        title="Recurring invoices"
        action={<LinkButton href="/recurring/new">+ New recurring invoice</LinkButton>}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No recurring invoices set up"
          hint="Great for hosting plans, retainers, or anything you bill on a fixed schedule — set it up once and invoices generate automatically."
          action={<LinkButton href="/recurring/new">Set up your first one</LinkButton>}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const { total } = calcTotals(r.items, r.taxRate, r.discount);
            const toggle = toggleRecurringActive.bind(null, r.id, !r.active);
            return (
              <Card key={r.id} className={!r.active ? "opacity-60" : ""}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Link href={`/recurring/${r.id}`} className="font-medium text-ink hover:text-forest">
                      {r.client?.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                      <span className="font-mono uppercase tracking-wide">
                        {FREQUENCY_LABEL[r.frequency]}
                      </span>
                      <span>·</span>
                      <span>Next: {formatDate(r.nextRunDate)}</span>
                      <span>·</span>
                      <span className="font-mono">{formatMoney(total)}</span>
                      {r.autoSend && (
                        <>
                          <span>·</span>
                          <span className="text-forest">Auto-sends by email</span>
                        </>
                      )}
                    </div>
                  </div>
                  <form action={toggle}>
                    <button
                      className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wide ${
                        r.active ? "border-forest text-forest" : "border-rule-strong text-ink-soft"
                      }`}
                    >
                      {r.active ? "active" : "paused"}
                    </button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
