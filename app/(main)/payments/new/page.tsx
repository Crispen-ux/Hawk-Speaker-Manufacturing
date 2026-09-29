import { recordStandalonePayment } from "@/lib/actions/payments";
import { db } from "@/db";
import { invoices, payments, clients } from "@/db/schema";
import { desc, inArray } from "drizzle-orm";
import { getSettings } from "@/lib/numbering";
import { PageHeader, Field, inputClass, PrimaryButton, GhostLink, Card } from "@/components/ui";
import { calcTotals, formatDate, formatMoney, toNumber } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage() {
  const settings = await getSettings();
  const money = (v: string | number | null | undefined) => formatMoney(v, settings.currency || "R");

  const invRows = await db.query.invoices.findMany({
    with: { client: true, items: true, payments: true },
    orderBy: desc(invoices.createdAt),
  });
  const clientIds = Array.from(new Set(invRows.map((r) => r.clientId)));
  const clientRows = clientIds.length
    ? await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds))
    : [];
  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));

  const openInvoices = invRows
    .map((inv) => {
      const { total } = calcTotals(inv.items, inv.taxRate, inv.discount);
      const paid = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
      return { inv, balance: Math.max(total - paid, 0) };
    })
    .filter((r) => r.balance > 0);

  return (
    <div>
      <PageHeader eyebrow="Money in" title="Record payment" />
      <Card className="max-w-2xl">
        <form action={recordStandalonePayment} className="space-y-5">
          <Field label="Invoice">
            <select name="invoiceId" required className={inputClass} defaultValue="">
              <option value="">— Choose an open invoice —</option>
              {openInvoices.map(({ inv, balance }) => (
                <option key={inv.id} value={inv.id}>
                  {inv.number} · {clientName.get(inv.clientId) ?? "Client"} · due {formatDate(inv.dueDate)} · owing {money(balance)}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={`Amount (${settings.currency || "R"})`}>
              <input name="amount" inputMode="decimal" defaultValue="0" className={inputClass} />
            </Field>
            <Field label="Date">
              <input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
            </Field>
            <Field label="Method">
              <select name="method" className={inputClass}>
                <option value="">— None —</option>
                {["EFT", "Cash", "Card", "Cheque", "Other"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Note">
              <input name="note" className={inputClass} />
            </Field>
          </div>
          <p className="text-xs text-ink-soft">Recording a payment automatically issues a numbered receipt.</p>
          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit">Record payment</PrimaryButton>
            <GhostLink href="/payments">Cancel</GhostLink>
          </div>
        </form>
      </Card>
    </div>
  );
}