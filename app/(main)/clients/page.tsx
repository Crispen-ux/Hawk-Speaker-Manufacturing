import { db } from "@/db";
import { clients } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import { getAllClientSummaries } from "@/lib/crm";
import { formatMoney, formatDate } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const rows = await db.select().from(clients).orderBy(desc(clients.createdAt));
  const summaries = await getAllClientSummaries();

  return (
    <div>
      <PageHeader
        eyebrow="Address book"
        title="Clients"
        action={<LinkButton href="/clients/new">+ New client</LinkButton>}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No clients yet"
          hint="Add the people and businesses you bill, so invoices and quotations can find them."
          action={<LinkButton href="/clients/new">Add your first client</LinkButton>}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-rule">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Phone</th>
                <th className="px-4 py-2.5 text-right font-medium">Billed</th>
                <th className="px-4 py-2.5 text-right font-medium">Outstanding</th>
                <th className="px-4 py-2.5 text-right font-medium">Open quotes</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const s = summaries.get(c.id);
                return (
                  <tr key={c.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${c.id}`} className="font-medium text-ink hover:text-forest">
                        {c.name}
                      </Link>
                      {c.email && <div className="text-xs text-ink-soft">{c.email}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-soft">{c.phone || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{s ? formatMoney(s.totalBilled) : "—"}</td>
                    <td className={`px-4 py-3 text-right font-mono ${s && s.outstanding > 0 ? "text-rust" : "text-ink-soft"}`}>
                      {s ? formatMoney(s.outstanding) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {s && s.openQuotationCount > 0 ? (
                        <span className="text-forest">{s.openQuotationCount} · {formatMoney(s.openQuotationValue)}</span>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-ink-soft whitespace-nowrap md:table-cell">
                      {s?.lastActivityAt ? formatDate(s.lastActivityAt.toISOString()) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
