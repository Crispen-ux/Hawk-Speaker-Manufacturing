import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const rows = await db.select().from(suppliers).orderBy(desc(suppliers.createdAt));

  return (
    <div>
      <PageHeader
        eyebrow="Vendor directory"
        title="Suppliers"
        action={<LinkButton href="/suppliers/new">+ New supplier</LinkButton>}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No suppliers yet"
          hint="Add the vendors you buy from, so purchase orders can find them."
          action={<LinkButton href="/suppliers/new">Add your first supplier</LinkButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Phone</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="px-4 py-3">
                    <Link href={`/suppliers/${c.id}`} className="font-medium text-ink hover:text-forest">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{c.email || "—"}</td>
                  <td className="px-4 py-3 font-mono text-ink-soft">{c.phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
