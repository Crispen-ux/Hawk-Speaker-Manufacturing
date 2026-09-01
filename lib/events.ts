import { randomUUID } from "node:crypto";

/**
 * The application's event bus. Business services emit structured events
 * (quotation.approved, payment.received, …) here instead of calling email /
 * WhatsApp / invoice / accounting code directly. Subscribers — chiefly the
 * automation engine — react to those events.
 *
 * The payload is deliberately structured, tenant-aware, traceable and
 * idempotently processable: every event carries a unique `id` that the
 * automation engine uses to prevent an event from being processed twice.
 */

export const TENANT_ID = 1; // single-tenant install; settings row id=1

export type BusinessEvent = {
  id: string;
  event: string;
  entityType: string;
  entityId: number;
  entityNumber?: string;
  tenantId: number;
  actorId?: string;
  timestamp: string;
  data: Record<string, unknown>;
};

export type EmitOptions = {
  entityType?: string;
  entityId?: number;
  entityNumber?: string;
  actorId?: string;
  data?: Record<string, unknown>;
};

/**
 * Emits an event and runs any matching automation in-process.
 *
 * This is awaited by the emitter on purpose: for the built-in workflow the
 * downstream work (e.g. converting an approved quotation to an invoice) must
 * complete inside the same request so its result is visible to the caller and
 * can be audited together with the decision. Failures are contained per
 * automation and never propagate, so a broken automation can't roll back the
 * business decision that triggered it.
 */
export async function emit(eventName: string, opts: EmitOptions = {}): Promise<void> {
  const event: BusinessEvent = {
    event: eventName,
    entityType: opts.entityType ?? "generic",
    entityId: opts.entityId ?? 0,
    entityNumber: opts.entityNumber,
    tenantId: TENANT_ID,
    actorId: opts.actorId,
    timestamp: new Date().toISOString(),
    data: opts.data ?? {},
    id: randomUUID(),
  };

  // Lazy import breaks the static cycle events -> engine -> actions -> services -> events.
  const { executeAutomationsForEvent } = await import("@/lib/automation/engine");

  try {
    await executeAutomationsForEvent(event);
  } catch (e) {
    // An event emitter must never take down the calling business flow.
    console.error("[events] automation dispatch failed", e);
  }
}
