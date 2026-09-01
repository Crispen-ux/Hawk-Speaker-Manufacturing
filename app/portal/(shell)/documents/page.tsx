import { requireActivePortalUser } from "@/lib/auth-portal";
import { getPortalInvoices, getPortalQuotations, getPortalReceipts, getPortalCreditNotes } from "@/lib/portal-data";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/money";

export const dynamic = "force-dynamic";

type DocRow = { kind: string; ref: string; date: string; href: string };

export default async function PortalDocumentsPage() {
  const session = await requireActivePortalUser();
  const [invoices, quotations, receipts, creditNotes] = await Promise.all([
    getPortalInvoices(session.clientId),
    getPortalQuotations(session.clientId),
    getPortalReceipts(session.clientId),
    getPortalCreditNotes(session.clientId),
  ]);

  const docs: DocRow[] = [
    ...invoices.map((i) => ({ kind: "Invoice", ref: i.number, date: i.issueDate, href: `/api/portal/pdf/invoice/${i.id}` })),
    ...quotations.map((q) => ({ kind: "Quotation", ref: q.number, date: q.issueDate, href: `/api/portal/pdf/quotation/${q.id}` })),
    ...receipts.map((r) => ({ kind: "Receipt", ref: r.number, date: r.issueDate, href: `/api/portal/pdf/receipt/${r.id}` })),
    ...creditNotes.map((c) => ({ kind: "Credit note", ref: c.number, date: c.issueDate, href: `/api/portal/pdf/credit-note/${c.id}` })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <PageHeader eyebrow="Client portal" title="Documents" />
      {docs.length === 0 ? (
        <EmptyState title="No documents yet" hint="Documents shared with you will appear here." />
      ) : (
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-rule bg-paper-dim/60">
              <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {docs.map((d, i) => (
                <tr key={i} className="border-b border-rule last:border-0">
                  <td className="px-4 py-3 text-ink-soft">{d.kind}</td>
                  <td className="px-4 py-3 font-medium text-ink">{d.ref}</td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(d.date)}</td>
                  <td className="px-4 py-3 text-right">
                    <a href={d.href} className="text-sm font-medium text-forest hover:underline" target="_blank" rel="noreferrer">
                      Open PDF
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