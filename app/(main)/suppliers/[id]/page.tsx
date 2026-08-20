import { db } from "@/db";
import { suppliers, purchaseOrders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { updateSupplier, deleteSupplier } from "@/lib/actions/suppliers";
import { PageHeader, Field, inputClass, PrimaryButton, Card } from "@/components/ui";
import StatusStamp from "@/components/StatusStamp";
import { formatDate } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplierId = Number(id);
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
  if (!supplier) notFound();

  const orders = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.supplierId, supplierId))
    .orderBy(desc(purchaseOrders.createdAt));

  const updateWithId = updateSupplier.bind(null, supplierId);
  const deleteWithId = deleteSupplier.bind(null, supplierId);

  return (
    <div>
      <PageHeader eyebrow="Vendor file" title={supplier.name} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
        <Card>
          <form action={updateWithId} className="space-y-4">
            <Field label="Name">
              <input name="name" defaultValue={supplier.name} required className={inputClass} />
            </Field>
            <Field label="Email">
              <input name="email" defaultValue={supplier.email ?? ""} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input name="phone" defaultValue={supplier.phone ?? ""} className={inputClass} />
            </Field>
            <Field label="Address">
              <textarea name="address" defaultValue={supplier.address ?? ""} rows={3} className={inputClass} />
            </Field>
            <Field label="Notes">
              <textarea name="notes" defaultValue={supplier.notes ?? ""} rows={2} className={inputClass} />
            </Field>
            <div className="flex items-center justify-between pt-2">
              <PrimaryButton type="submit">Save changes</PrimaryButton>
              <form action={deleteWithId}>
                <button type="submit" className="font-mono text-xs uppercase tracking-wide text-rust hover:underline">
                  Delete supplier
                </button>
              </form>
            </div>
          </form>
        </Card>

        <div>
          <h2 className="mb-3 font-display text-lg font-bold text-navy">Purchase orders</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-ink-soft">No purchase orders for this supplier yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-rule">
              <table className="w-full text-sm">
                <tbody>
                  {orders.map((po) => (
                    <tr key={po.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                      <td className="px-4 py-2.5">
                        <Link href={`/purchase-orders/${po.id}`} className="font-mono text-ink hover:text-forest">
                          {po.number}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft">{formatDate(po.issueDate)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <StatusStamp status={po.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
