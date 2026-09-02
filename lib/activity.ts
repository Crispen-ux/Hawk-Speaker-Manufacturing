import { db } from "@/db";
import { clientActivities } from "@/db/schema";
import { logAudit } from "@/lib/audit";

export type AutoActivityInput = {
  clientId: number;
  type: "call" | "note" | "meeting" | "follow_up" | "manual";
  title: string;
  description?: string | null;
  documentKind?: string;
  documentId?: number;
};

/**
 * Log a client activity programmatically (from document events like
 * "invoice sent", "quotation accepted"). Non-destructive: safe to call
 * from anywhere (fire-and-forget with `void logClientActivity(...)`).
 */
export async function logClientActivity(input: AutoActivityInput) {
  try {
    const [row] = await db
      .insert(clientActivities)
      .values({
        clientId: input.clientId,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        documentKind: input.documentKind ?? null,
        documentId: input.documentId ?? null,
        auto: true,
      })
      .returning({ id: clientActivities.id });

    void logAudit({
      documentKind: "clientActivity",
      documentId: row.id,
      action: "auto_created",
      detail: input.title,
    });

    return row;
  } catch {
    // Auto-logging must never break the primary document action.
    return null;
  }
}
