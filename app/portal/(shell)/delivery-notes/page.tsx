import { requireActivePortalUser } from "@/lib/auth-portal";
import { getPortalDeliveryNotes } from "@/lib/portal-data";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PortalDeliveryNotesPage() {
  const session = await requireActivePortalUser();
  const rows = await getPortalDeliveryNotes(session.clientId);

  return (
    <div>
      <PageHeader eyebrow="Client portal" title="Delivery notes" />
      {rows.length === 0 ? (
        <EmptyState title="No delivery notes" hint="Delivery notes raised for you will appear here." />
      ) : (
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-rule bg-paper-dim/60">
              <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
                <th className="px-4 py-3">Delivery note</th>
                <th className="px-4 py-3">Delivered</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-b border-rule last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{d.number}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(d.deliveryDate)}</td>
                  <td className="px-4 py-3 capitalize">{d.status}</td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/api/portal/pdf/delivery-note/${d.id}`} className="text-sm font-medium text-forest hover:underline">
                      PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}