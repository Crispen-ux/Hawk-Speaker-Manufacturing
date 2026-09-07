import { PageHeader, Card } from "@/components/ui";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { asc } from "drizzle-orm";
import { createAccount, toggleAccount } from "@/lib/actions/accounting";

export const dynamic = "force-dynamic";

const types = ["asset", "liability", "equity", "income", "expense"] as const;

export default async function ChartOfAccountsPage() {
  const accountRows = await db.select().from(accounts).orderBy(asc(accounts.sortOrder), asc(accounts.code));
  return (
    <div>
      <PageHeader eyebrow="Accounting structure" title="Chart of accounts" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-rule bg-paper-dim font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft"><th className="px-4 py-3 text-left">Code</th><th className="px-4 py-3 text-left">Account</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Source</th></tr></thead>
              <tbody>{accountRows.map((account) => <tr key={account.id} className="border-b border-rule last:border-b-0"><td className="px-4 py-3 font-mono">{account.code}</td><td className="px-4 py-3"><div className="font-medium">{account.name}</div>{account.description && <div className="text-xs text-ink-soft">{account.description}</div>}</td><td className="px-4 py-3 capitalize">{account.type}</td><td className="px-4 py-3">{account.active ? "Active" : "Inactive"}</td><td className="px-4 py-3">{account.isSystem ? "System" : "Custom"}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-lg font-bold text-navy">Add account</h2>
          <p className="mt-1 text-xs text-ink-soft">Custom accounts can be used for manual journals and expense classification. System accounts remain application-controlled.</p>
          <form action={createAccount} className="mt-5 space-y-3">
            <input name="code" required maxLength={16} placeholder="e.g. 5800" className="w-full rounded-md border border-rule-strong bg-white px-3 py-2 text-sm" />
            <input name="name" required maxLength={128} placeholder="Account name" className="w-full rounded-md border border-rule-strong bg-white px-3 py-2 text-sm" />
            <select name="type" required className="w-full rounded-md border border-rule-strong bg-white px-3 py-2 text-sm">{types.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}</select>
            <input name="description" maxLength={500} placeholder="Description (optional)" className="w-full rounded-md border border-rule-strong bg-white px-3 py-2 text-sm" />
            <button className="w-full rounded-md bg-navy px-4 py-2 text-sm font-semibold text-paper hover:bg-navy-2">Create account</button>
          </form>
          <div className="mt-6 border-t border-rule pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">Account controls</p>
            <div className="mt-3 space-y-2">{accountRows.filter((a) => !a.isSystem).map((account) => <form key={account.id} action={toggleAccount.bind(null, account.id, !account.active)} className="flex items-center justify-between rounded-md border border-rule p-2.5"><span className="text-xs">{account.code} · {account.name}</span><button className="text-xs underline">{account.active ? "Deactivate" : "Activate"}</button></form>)}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
