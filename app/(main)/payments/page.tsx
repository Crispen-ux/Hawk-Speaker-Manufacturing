import { db } from "@/db";
import { payments, receipts, invoices, clients } from "@/db/schema";
import { desc, inArray } from "drizzle-orm";
import { PageHeader, LinkButton, EmptyState } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/money";
import { getSettings } from "@/lib/numbering";
import { deletePayment } from "@/lib/actions/invoices";
import ConfirmForm from "@/components/ConfirmForm";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const paymentRows = await db.select().from(payments).orderBy(desc(payments.date)).limit(300);
  const invoiceIds = Array.from(new Set(paymentRows.map((p) => p.invoiceId)));
  const invRows = invoiceIds.length
    ? await db.select({ id: invoices.id, number: invoices.number, clientId: invoices.clientId }).from(invoices).where(inArray(invoices.id, invoiceIds))
    : [];
  const clientIds = Array.from(new Set(invRows.map((r) => r.clientId)));
  const clientRows = clientIds.length
    ? await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds))
    : [];
const clientName = new Map(clientRows.map((c) => [c.id, c.name]));
  const invMeta = new Map(invRows.map((r) => [r.id, r]));
  const receiptNos = await db
    .select({ paymentId: receipts.paymentId, number: receipts.number, id: receipts.id })
    .from(receipts)
    .where(inArray(receipts.paymentId, paymentRows.map((p) => p.id)));

  const total = paymentRows.reduce((s, p) => s + Number(p.amount || 0), 0);
  const byClient = new Map<number, { id: number; name: string; total: number }>();
  for (const p of paymentRows) {
    const inv = invMeta.get(p.invoiceId);
    if (!inv) continue;
    const row = byClient.get(inv.clientId) ?? { id: inv.clientId, name: clientName.get(inv.clientId) ?? "Unknown", total: 0 };
    row.total += Number(p.amount || 0);
    byClient.set(inv.clientId, row);
  }
  const topClients = Array.from(byClient.values()).sort((a, b) => b.total - a.total).slice(0, 5);

  return (
    <div>
      <PageHeader
        eyebrow="Money in"
        title="Payments"
        action={<LinkButton href="/payments/new">+ Record payment</LinkButton>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2 font-mono text-xs text-ink-soft">
        <span>
          Total received: <span className="font-semibold text-ink">{money(total)}</span>
        </span>
        <span className="text-rule-strong">|</span>
        <span>
          Payments: <span className="font-semibold text-ink">{paymentRows.length}</span>
        </span>
      </div>

      {topClients.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {topClients.map((c) => (
            <div key={c.id} className="rounded-lg border border-rule p-3">
              <div className="truncate text-xs text-ink-soft">{c.name}</div>
              <div className="mt-1 font-mono text-sm font-semibold text-ink">{money(c.total)}</div>
            </div>
          ))}
        </div>
      )}

      {paymentRows.length === 0 ? (
        <EmptyState title="No payments yet" hint="Payments recorded against invoices appear here, each minting a numbered receipt." action={<LinkButton href="/payments/new">Record a payment</LinkButton>} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Invoice</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Method</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-right font-medium">Receipt</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.map((p) => {
                const inv = invMeta.get(p.invoiceId);
                const receipt = receiptNos.find((r) => r.paymentId === p.id);
                const remove = deletePayment.bind(null, p.id, p.invoiceId);
                return (
                  <tr key={p.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
                    <td className="px-4 py-3 text-ink-soft">{formatDate(p.date)}</td>
                    <td className="px-4 py-3">
                      {inv ? (
                        <a href={`/invoices/${p.invoiceId}`} className="font-mono font-medium text-ink hover:text-forest">
                          {inv.number}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{inv ? (clientName.get(inv.clientId) ?? "—") : "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{p.method || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(p.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      {receipt ? (
                        <a
                          href={`/api/receipts/pdf/${receipt.id}`}
                          target="_blank"
                          className="font-mono text-xs text-forest hover:underline"
                        >
                          {receipt.number}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ConfirmForm action={remove} confirm="Delete this payment? The receipt attached to it is removed too.">
                        <button className="font-mono text-xs text-rust hover:underline">delete</button>
                      </ConfirmForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}