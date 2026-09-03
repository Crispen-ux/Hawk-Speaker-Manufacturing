import { db } from "@/db";
import {
  clients,
  invoices,
  quotations,
  creditNotes,
  payments,
  clientActivities,
  opportunities,
} from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { calcTotals, toNumber } from "@/lib/money";

export type ClientCrmSummary = {
  clientId: number;
  totalBilled: number;
  paid: number;
  outstanding: number;
  overdue: number;
  invoiceCount: number;
  openQuotationCount: number;
  openQuotationValue: number;
  wonOpportunityValue: number;
  openOpportunityValue: number;
  openOpportunityCount: number;
  lastActivityAt: Date | null;
};

const OPEN_QUOTE_STATUSES = ["draft", "sent", "accepted"] as const;
const WON_QUOTE_STATUSES = ["accepted"] as const;
const OPEN_OPPORTUNITY_STAGES = ["new", "proposal", "negotiation"] as const;

function invoiceFigures(items: { quantity: string | number; unitPrice: string | number }[], taxRate: string | number, discount: string | number, paymentsArr: { amount: string | number }[]) {
  const { total } = calcTotals(items, taxRate, discount);
  const paid = paymentsArr.reduce((s, p) => s + toNumber(p.amount), 0);
  return { total, paid, balance: Math.max(total - paid, 0) };
}

/**
 * CRM summary for one client: billing position, open opportunities and the
 * most recent activity — everything you need for the client 360 dashboard.
 */
export async function getClientSummary(clientId: number): Promise<ClientCrmSummary> {
  const invRows = await db.query.invoices.findMany({
    where: eq(invoices.clientId, clientId),
    with: { items: true, payments: true },
  });

  const today = new Date().toISOString().slice(0, 10);
  let totalBilled = 0;
  let paid = 0;
  let outstanding = 0;
  let overdue = 0;
  for (const inv of invRows) {
    if (inv.status === "cancelled") continue;
    const figures = invoiceFigures(inv.items, inv.taxRate, inv.discount, inv.payments);
    totalBilled += figures.total;
    paid += figures.paid;
    outstanding += figures.balance;
    if (figures.balance > 0 && inv.dueDate < today) overdue += figures.balance;
  }

  const cnRows = await db.query.creditNotes.findMany({
    where: eq(creditNotes.clientId, clientId),
    with: { items: true },
  });
  for (const cn of cnRows) {
    if (cn.status === "cancelled") continue;
    const { total } = calcTotals(cn.items, cn.taxRate, cn.discount);
    outstanding = Math.max(outstanding - total, 0);
  }

  const qRows = await db.query.quotations.findMany({
    where: eq(quotations.clientId, clientId),
    with: { items: true },
  });
  let openQuotationCount = 0;
  let openQuotationValue = 0;
  for (const q of qRows) {
    const total = calcTotals(q.items, q.taxRate, q.discount).total;
    if ((WON_QUOTE_STATUSES as readonly string[]).includes(q.status)) continue;
    if ((OPEN_QUOTE_STATUSES as readonly string[]).includes(q.status)) {
      openQuotationCount += 1;
      openQuotationValue += total;
    }
  }

  const oppRows = await db.select().from(opportunities).where(eq(opportunities.clientId, clientId));
  let wonOpportunityValue = 0;
  let openOpportunityValue = 0;
  let openOpportunityCount = 0;
  for (const o of oppRows) {
    if (o.stage === "won") wonOpportunityValue += toNumber(o.value);
    if ((OPEN_OPPORTUNITY_STAGES as readonly string[]).includes(o.stage)) {
      openOpportunityCount += 1;
      openOpportunityValue += toNumber(o.value);
    }
  }

  const [lastActivity] = await db
    .select({ createdAt: clientActivities.createdAt })
    .from(clientActivities)
    .where(eq(clientActivities.clientId, clientId))
    .orderBy(desc(clientActivities.createdAt))
    .limit(1);

  return {
    clientId,
    totalBilled,
    paid,
    outstanding,
    overdue,
    invoiceCount: invRows.filter((i) => i.status !== "cancelled").length,
    openQuotationCount,
    openQuotationValue,
    wonOpportunityValue,
    openOpportunityValue,
    openOpportunityCount,
    lastActivityAt: lastActivity?.createdAt ?? null,
  };
}

/**
 * CRM summary for every client — drives the Client list index columns so you
 * can triage the whole book at a glance.
 */
export async function getAllClientSummaries(): Promise<Map<number, ClientCrmSummary>> {
  const allClients = await db.select({ id: clients.id }).from(clients);
  const map = new Map<number, ClientCrmSummary>();
  for (const c of allClients) {
    map.set(c.id, await getClientSummary(c.id));
  }
  return map;
}
