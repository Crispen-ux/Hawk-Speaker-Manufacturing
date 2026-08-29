import { db } from "@/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { assets } from "@/db/schema";
import { deleteAsset, setAssetStatus } from "@/lib/actions/assets";
import { formatDate, formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { PageHeader, GhostLink, Card } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assetId = Number(id);
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId));
  if (!asset) notFound();
  const remove = deleteAsset.bind(null, assetId);
  const setStatus = setAssetStatus.bind(null, assetId);

  return (
    <div>
      <PageHeader
        eyebrow={asset.category || "Asset"}
        title={asset.name}
        action={
          <div className="flex items-center gap-2">
            <StatusStamp status={asset.status} />
            <GhostLink href={`/assets/${assetId}/edit`}>Edit</GhostLink>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <Card>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Status</div>
                <div className="text-ink">{asset.status}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Value</div>
                <div className="text-ink">{money(asset.value)}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Serial</div>
                <div className="font-mono text-ink">{asset.serialNumber || "—"}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Purchased</div>
                <div className="text-ink">{asset.purchaseDate ? formatDate(asset.purchaseDate) : "—"}</div>
              </div>
            </div>
            {asset.notes && (
              <div className="mt-6 border-t border-rule pt-4 text-sm text-ink-soft">{asset.notes}</div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">Status</h3>
            <div className="flex flex-wrap gap-2">
              {(["active", "maintenance", "disposed"] as const).map((s) => (
                <form key={s} action={setStatus.bind(null, s)}>
                  <button className="rounded-full border border-rule-strong px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-ink-soft hover:border-forest hover:text-forest">
                    mark {s}
                  </button>
                </form>
              ))}
            </div>
          </Card>

          <form action={remove}>
            <button className="w-full font-mono text-xs uppercase tracking-wide text-rust hover:underline">
              Delete asset
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}