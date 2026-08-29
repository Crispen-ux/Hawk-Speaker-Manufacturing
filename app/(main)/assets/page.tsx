import Link from "next/link";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import { formatDate, formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";

export const dynamic = "force-dynamic";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");
  const rows = await db.select().from(assets).orderBy(assets.name);

  const filtered = status && status !== "all" ? rows.filter((r) => r.status === status) : rows;
  const totalValue = rows.reduce((s, r) => s + Number(r.value || 0), 0);
  const filters = ["all", "active", "maintenance", "disposed"];

  return (
    <div>
      <PageHeader
        eyebrow="Assets"
        title="Asset register"
        action={<LinkButton href="/assets/new">+ Add asset</LinkButton>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/assets" : `/assets?status=${f}`}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wide ${
              (f === "all" && !status) || status === f
                ? "border-forest bg-forest text-paper"
                : "border-rule-strong text-ink-soft hover:bg-paper-dim"
            }`}
          >
            {f}
          </Link>
        ))}
        <span className="ml-auto font-mono text-xs text-ink-soft">
          Total value: <span className="font-semibold text-ink">{money(totalValue)}</span>
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No assets here" hint="Add company equipment, vehicles and tools to the register." action={<LinkButton href="/assets/new">Add an asset</LinkButton>} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Serial</th>
                <th className="px-4 py-2.5 font-medium">Purchased</th>
                <th className="px-4 py-2.5 text-right font-medium">Value</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                  <td className="px-4 py-3">
                    <Link href={`/assets/${a.id}`} className="font-medium text-ink hover:text-forest">
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{a.category || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-soft">{a.serialNumber || "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{a.purchaseDate ? formatDate(a.purchaseDate) : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{money(a.value)}</td>
                  <td className="px-4 py-3 text-right">
                    <StatusStamp status={a.status} />
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