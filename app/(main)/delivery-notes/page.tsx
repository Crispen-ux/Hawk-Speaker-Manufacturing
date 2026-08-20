import { db } from "@/db";
import Link from "next/link";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import { formatDate } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function DeliveryNotesPage() {
  const rows = await db.query.deliveryNotes.findMany({
    with: { client: true, items: true },
    orderBy: (deliveryNotes, { desc }) => [desc(deliveryNotes.createdAt)],
  });

  return (
    <div>
      <PageHeader
        eyebrow="Logistics"
        title="Delivery notes"
        action={<LinkButton href="/delivery-notes/new">+ New delivery note</LinkButton>}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No delivery notes yet"
          hint="Record what was delivered to a client and who signed for it — proof of delivery, not a bill."
          action={<LinkButton href="/delivery-notes/new">Create a delivery note</LinkButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Delivery date</th>
                <th className="px-4 py-2.5 font-medium">Items</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((dn) => (
                <tr key={dn.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="px-4 py-3">
                    <Link href={`/delivery-notes/${dn.id}`} className="font-mono font-medium text-ink hover:text-forest">
                      {dn.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{dn.client?.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(dn.deliveryDate)}</td>
                  <td className="px-4 py-3 text-ink-soft">{dn.items.length}</td>
                  <td className="px-4 py-3 text-right">
                    <StatusStamp status={dn.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
