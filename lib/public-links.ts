import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { documentLinks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getBaseUrl } from "@/lib/base-url";

/**
 * Public share links for documents sent over WhatsApp.
 *
 * Every shared document gets a row in `document_links` holding a random,
 * unguessable token. The token (never the numeric id) is what travels in the
 * message, so documents can't be enumerated by guessing — and a link can be
 * revoked by deleting its row.
 */

export type SharedLinkKind = "invoice" | "quotation" | "deliveryNote" | "statement" | "creditNote" | "receipt";
export type PersistedLinkKind = Exclude<SharedLinkKind, "statement">;

export type SharedLinkMeta =
  | { kind: PersistedLinkKind; documentId: number }
  | { kind: "statement"; clientId: number; fromDate: string; toDate: string };

/** Returns the existing token for a stored document, or creates one. */
export async function ensureDocumentLink(kind: PersistedLinkKind, documentId: number): Promise<string> {
  const existing = await db
    .select({ token: documentLinks.token })
    .from(documentLinks)
    .where(and(eq(documentLinks.kind, kind), eq(documentLinks.documentId, documentId)))
    .limit(1);
  if (existing[0]) return existing[0].token;

  const token = randomUUID();
  const [row] = await db
    .insert(documentLinks)
    .values({ kind, documentId, token })
    .returning({ token: documentLinks.token });
  return row.token;
}

/** Returns the existing token for a statement range, or creates one. */
export async function ensureStatementLink(clientId: number, fromDate: string, toDate: string): Promise<string> {
  const existing = await db
    .select({ token: documentLinks.token })
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.kind, "statement"),
        eq(documentLinks.clientId, clientId),
        eq(documentLinks.fromDate, fromDate),
        eq(documentLinks.toDate, toDate)
      )
    )
    .limit(1);
  if (existing[0]) return existing[0].token;

  const token = randomUUID();
  const [row] = await db
    .insert(documentLinks)
    .values({ kind: "statement", clientId, fromDate, toDate, token })
    .returning({ token: documentLinks.token });
  return row.token;
}

/**
 * Full public URL for a shared document, ready to drop into a WhatsApp
 * template. Returns "" when no base URL is configured so callers degrade
 * gracefully (the message simply omits the link).
 */
export async function publicDocumentUrl(meta: SharedLinkMeta): Promise<string> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return "";

  const token =
    meta.kind === "statement"
      ? await ensureStatementLink(meta.clientId, meta.fromDate, meta.toDate)
      : await ensureDocumentLink(meta.kind, meta.documentId);
  return `${baseUrl}/shared/${token}`;
}

/** Looks up what a share token points at; null when the token is unknown. */
export async function resolveDocumentLink(token: string): Promise<SharedLinkMeta | null> {
  if (!token) return null;
  const row = await db.select().from(documentLinks).where(eq(documentLinks.token, token)).limit(1);
  const link = row[0];
  if (!link) return null;

  if (link.kind === "statement") {
    if (!link.clientId || !link.fromDate || !link.toDate) return null;
    return { kind: "statement", clientId: link.clientId, fromDate: link.fromDate, toDate: link.toDate };
  }

  const kind = link.kind as PersistedLinkKind;
  if (!link.documentId) return null;
  return { kind, documentId: link.documentId };
}

/** Deletes a share link, revoking it. */
export async function revokeDocumentLink(token: string): Promise<void> {
  await db.delete(documentLinks).where(eq(documentLinks.token, token));
}