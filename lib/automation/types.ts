import type { BusinessEvent } from "@/lib/events";

/**
 * Shared types for the automation engine. Designed so new triggers, conditions
 * and actions can be added by extending these registries without rewriting the
 * engine itself.
 */

/** Trigger events the engine understands. Extend to add more. */
export const AUTOMATION_TRIGGERS = [
  "quotation.created",
  "quotation.sent",
  "quotation.viewed",
  "quotation.approved",
  "quotation.declined",
  "invoice.created",
  "invoice.sent",
  "invoice.viewed",
  "invoice.overdue",
  "payment.received",
  "purchase_order.approved",
  "expense.approved",
  "document.expiring",
  "inventory.low_stock",
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export type ConditionOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "contains";

/** A single condition evaluated against an event's data. */
export type AutomationCondition = {
  field: string;
  op: ConditionOp;
  value: string | number | (string | number)[];
};

/** Actions the engine can execute. Extend AUTOMATION_ACTIONS + the registry to add more. */
export const AUTOMATION_ACTIONS = [
  "sendEmail",
  "sendWhatsApp",
  "createInvoice",
  "convertQuotationToInvoice",
  "createNotification",
  "setDocumentStatus",
  "recordEvent",
] as const;

export type AutomationActionType = (typeof AUTOMATION_ACTIONS)[number];

/** Config passed to an individual action. */
export type AutomationActionConfig = Record<string, unknown>;

export interface AutomationContext {
  event: BusinessEvent;
  /** The module keys that are currently enabled, for graceful degradation. */
  enabledModules: Record<string, boolean>;
  /** Mutable state shared across steps (e.g. `invoiceId` set by conversion). */
  source: Record<string, unknown>;
  entityType: string;
  entityId: number;
  entityNumber?: string;
}

export interface ActionResult {
  ok: boolean;
  detail?: string;
  /** Newly created entity references, e.g. { invoiceId: 7 } */
  refs?: Record<string, number | string>;
}

/** An individual action executor: a function taking config + context. */
export type ActionExecutor = (
  config: AutomationActionConfig,
  ctx: AutomationContext
) => Promise<ActionResult>;

/** A registered action. Optionally declares the module it depends on. */
export interface AutomationActionEntry {
  requiresModule?: string;
  execute: ActionExecutor;
}
