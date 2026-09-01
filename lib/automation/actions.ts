import type { AutomationActionType, ActionResult, AutomationActionEntry } from "./types";
import { logAudit } from "@/lib/audit";

/**
 * The action registry. Each action knows which module it depends on and
 * gracefully reports a "skipped" outcome (rather than failing) when that
 * module is disabled, so the whole workflow degrades cleanly.
 *
 * Extending the engine with a new action is: add a name to AUTOMATION_ACTIONS
 * (types.ts) and register an executor here.
 */

/** Each action optionally declares which module it depends on. */
type Executor = AutomationActionEntry;

/** Resolve the recipient contact for a document from its client record. */
async function clientContact(kind: string, entityId: number): Promise<{ email: string; phone: string }> {
  const { db } = await import("@/db");
  const { eq } = await import("drizzle-orm");
  const tableMap: Record<string, any> = {
    invoice: (await import("@/db/schema")).invoices,
    quotation: (await import("@/db/schema")).quotations,
    creditNote: (await import("@/db/schema")).creditNotes,
    deliveryNote: (await import("@/db/schema")).deliveryNotes,
    purchaseOrder: (await import("@/db/schema")).purchaseOrders,
  };
  const table = tableMap[kind];
  if (!table) return { email: "", phone: "" };
  const rows = await (db as any)
    .select({ clientId: table.clientId })
    .from(table)
    .where(eq(table.id, entityId))
    .limit(1);
  const clientId = rows[0]?.clientId;
  if (!clientId) return { email: "", phone: "" };
  const { clients } = await import("@/db/schema");
  const crows = await (db as any).select().from(clients).where(eq(clients.id, clientId)).limit(1);
  return { email: crows[0]?.email ?? "", phone: crows[0]?.phone ?? "" };
}

const GET_MODULE_MAP: Record<string, string> = {
  invoice: "invoices",
  quotation: "quotations",
  creditNote: "creditNotes",
  receipt: "receipts",
  deliveryNote: "deliveryNotes",
  purchaseOrder: "purchaseOrders",
};

/** Interpolates {{token}} placeholders from event data + shared step state. */
function expand(text: unknown, source: Record<string, unknown>): unknown {
  if (typeof text !== "string") return text;
  if (!text.includes("{{")) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = source[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

const executors: Record<AutomationActionType, Executor> = {
  sendEmail: {
    requiresModule: "email",
    async execute(config, ctx): Promise<ActionResult> {
      const kind = String(config.kind ?? "invoice");
      const entityId = Number(expand(config.entityId, ctx.source) ?? ctx.event.entityId);
      let to = String(expand(config.to, ctx.source) ?? "").trim();
      if (!to) to = (await clientContact(kind, entityId)).email;
      if (!to) return { ok: false, detail: `No recipient email for ${kind} ${entityId}` };
      const { sendInvoiceByEmail } = await import("@/lib/send");
      let delivered = false;
      if (kind === "invoice") {
        const sum = await sendInvoiceByEmail(entityId, to);
        delivered = sum.results.some((r) => r.channel === "email" && r.delivered);
      } else if (kind === "quotation") {
        const { sendQuotationByEmail } = await import("@/lib/send");
        await sendQuotationByEmail(entityId, to);
        delivered = true;
      } else {
        return { ok: false, detail: `Unsupported email kind ${kind}` };
      }
      return delivered
        ? { ok: true, detail: `${kind} ${entityId} emailed to ${to}` }
        : { ok: false, detail: "Email not configured or not delivered" };
    },
  },

  sendWhatsApp: {
    requiresModule: "whatsapp",
    async execute(config, ctx): Promise<ActionResult> {
      const kind = String(config.kind ?? "invoice");
      const entityId = Number(expand(config.entityId, ctx.source) ?? ctx.event.entityId);
      let to = String(expand(config.to, ctx.source) ?? "").trim();
      if (!to) to = (await clientContact(kind, entityId)).phone;
      const { sendInvoiceByWhatsApp } = await import("@/lib/send");
      const sum = await sendInvoiceByWhatsApp(entityId, to || undefined);
      const wa = sum.results.find((r) => r.channel === "whatsapp");
      if (wa?.delivered) return { ok: true, detail: `WhatsApp sent to ${to || "client number"}` };
      return { ok: false, detail: wa?.message ?? wa?.error ?? "WhatsApp not delivered" };
    },
  },

  createInvoice: {
    requiresModule: "invoices",
    async execute(_config, ctx): Promise<ActionResult> {
      // Generic invoice creation is reserved for full entity payloads. For the
      // quotation workflow prefer convertQuotationToInvoice which preserves
      // the quotation -> invoice relationship.
      return { ok: false, detail: "createInvoice requires a stock payload; use convertQuotationToInvoice" };
    },
  },

  convertQuotationToInvoice: {
    requiresModule: "invoices",
    async execute(_config, ctx): Promise<ActionResult> {
      const quotationId = Number(ctx.event.entityId);
      const { convertQuotationToInvoice } = await import("@/lib/services/invoices");
      const result = await convertQuotationToInvoice(quotationId, { actorId: ctx.event.actorId });
      ctx.source.invoiceId = result.invoiceId;
      ctx.source.invoiceNumber = result.invoiceNumber;
      return {
        ok: true,
        detail: result.existing
          ? `Invoice already exists ${result.invoiceNumber}`
          : `Invoice created ${result.invoiceNumber}`,
        refs: { invoiceId: result.invoiceId, invoiceNumber: result.invoiceNumber },
      };
    },
  },

  createNotification: {
    requiresModule: "notifications",
    async execute(config, ctx): Promise<ActionResult> {
      const { notify } = await import("@/lib/actions/notifications");
      const title = String(expand(config.title, ctx.source) ?? "Automation");
      const message = String(expand(config.message, ctx.source) ?? "");
      await notify({
        title,
        message,
        documentKind: ctx.entityType,
        documentId: ctx.entityId,
        level: "info",
      });
      return { ok: true, detail: `Notification created` };
    },
  },

  setDocumentStatus: {
    async execute(config, ctx): Promise<ActionResult> {
      const kind = String(expand(config.kind, ctx.source) ?? ctx.event.entityType);
      const moduleKey = GET_MODULE_MAP[kind];
      if (moduleKey && ctx.enabledModules[moduleKey] === false) {
        return { ok: false, detail: `Module ${moduleKey} disabled` };
      }
      const entityId = Number(expand(config.entityId, ctx.source) ?? ctx.event.entityId);
      const status = String(expand(config.status, ctx.source) ?? "");
      const { db } = await import("@/db");
      const { eq, and } = await import("drizzle-orm");
      const { quotations, invoices, purchaseOrders, jobCards, deliveryNotes, creditNotes } = await import(
        "@/db/schema"
      );
      const tableMap: Record<string, { table: any; statusCol: any }> = {
        quotation: { table: quotations, statusCol: quotations.status },
        invoice: { table: invoices, statusCol: invoices.status },
        purchaseOrder: { table: purchaseOrders, statusCol: purchaseOrders.status },
        jobCard: { table: jobCards, statusCol: jobCards.status },
        deliveryNote: { table: deliveryNotes, statusCol: deliveryNotes.status },
        creditNote: { table: creditNotes, statusCol: creditNotes.status },
      };
      const target = tableMap[kind];
      if (!target || !status) return { ok: false, detail: `Unsupported kind/status` };
      await (db as any).update(target.table).set({ [target.statusCol.name]: status }).where(eq(target.table.id, entityId));
      return { ok: true, detail: `${kind} ${entityId} → ${status}` };
    },
  },

  recordEvent: {
    async execute(config, ctx): Promise<ActionResult> {
      const action = String(expand(config.action, ctx.source) ?? "event_recorded");
      const detail = String(expand(config.detail, ctx.source) ?? JSON.stringify(ctx.event.data));
      await logAudit({
        documentKind: ctx.event.entityType,
        documentId: ctx.event.entityId,
        documentNumber: ctx.event.entityNumber,
        action,
        detail,
      });
      return { ok: true, detail: `Recorded ${action}` };
    },
  },
};

export function getActionExecutor(type: AutomationActionType): Executor {
  const ex = executors[type];
  if (!ex) throw new Error(`Unknown automation action: ${type}`);
  return ex;
}

export function isActionModuleAvailable(
  type: AutomationActionType,
  enabledModules: Record<string, boolean>
): boolean {
  const ex = executors[type];
  if (!ex?.requiresModule) return true;
  return enabledModules[ex.requiresModule] !== false;
}
