import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/ui";
import { getAuditLog, describeAction, describeKind, routeForDocument } from "@/lib/audit";
import type { AuditLogRow } from "@/lib/audit";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const rows = await getAuditLog(200);

  return (
    <div>
      <PageHeader eyebrow="Governance" title="Audit log" />
      <p className="-mt-5 mb-6 text-sm text-ink-soft">
        Newest first — actions against documents across the system (created, edited, sent, paid, converted,
        deleted).
      </p>

      {rows.length === 0 ? (
        <EmptyState title="Nothing logged yet" hint="Actions you take against documents will appear here." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Document</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="px-4 py-2.5 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-ink-soft">
                    {r.createdAt.toLocaleString("en-ZA", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={routeForDocument(r.documentKind, r.documentId)}
                      className="font-medium text-ink hover:text-forest"
                    >
                      {describeKind(r.documentKind)}
                      {r.documentNumber ? (
                        <span className="ml-1 font-mono text-xs text-ink-soft">{r.documentNumber}</span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{describeAction(r.action)}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{r.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}