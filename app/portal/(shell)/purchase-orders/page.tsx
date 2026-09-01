import { PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function PortalPurchaseOrdersPage() {
  return (
    <div>
      <PageHeader eyebrow="Client portal" title="Purchase orders" />
      <EmptyState
        title="No purchase orders"
        hint="Purchase orders are raised against suppliers, not clients, so none apply to your account. Documents shared with you directly are available under Documents."
      />
    </div>
  );
}