import AccountingTabs from "@/components/AccountingTabs";
import { ensureLedgerSeed } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export default async function AccountingLayout({ children }: { children: React.ReactNode }) {
  await ensureLedgerSeed();
  return (
    <div>
      <AccountingTabs />
      {children}
    </div>
  );
}