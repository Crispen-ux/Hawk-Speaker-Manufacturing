import { NextRequest } from "next/server";
import { sessionPortalUser } from "@/lib/auth-portal";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { invoices, quotations, receipts, creditNotes, deliveryNotes } from "@/db/schema";
import {
  renderInvoicePdf,
  renderQuotationPdf,
  renderReceiptPdf,
  renderCreditNotePdf,
  renderDeliveryNotePdf,
} from "@/lib/document-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Client-portal PDF downloads. The portal session must be valid AND the
 * document must belong to the authenticated client — object-level
 * authorization, so a hardened URL can never leak another client's document.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const numericId = Number.parseInt(id, 10);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const session = await sessionPortalUser();
  if (!session) return new Response("Unauthorized", { status: 401 });

  // Object-level authorization: confirm the document belongs to the client.
  let ownerClientId: number | null = null;
  if (kind === "invoice") {
    const row = await db.select({ c: invoices.clientId }).from(invoices).where(eq(invoices.id, numericId)).limit(1);
    ownerClientId = row[0]?.c ?? null;
  } else if (kind === "quotation") {
    const row = await db.select({ c: quotations.clientId }).from(quotations).where(eq(quotations.id, numericId)).limit(1);
    ownerClientId = row[0]?.c ?? null;
  } else if (kind === "receipt") {
    const row = await db.select({ c: receipts.clientId }).from(receipts).where(eq(receipts.id, numericId)).limit(1);
    ownerClientId = row[0]?.c ?? null;
  } else if (kind === "credit-note") {
    const row = await db.select({ c: creditNotes.clientId }).from(creditNotes).where(eq(creditNotes.id, numericId)).limit(1);
    ownerClientId = row[0]?.c ?? null;
  } else if (kind === "delivery-note") {
    const row = await db.select({ c: deliveryNotes.clientId }).from(deliveryNotes).where(eq(deliveryNotes.id, numericId)).limit(1);
    ownerClientId = row[0]?.c ?? null;
  }
  if (ownerClientId === null || ownerClientId !== session.clientId) {
    return new Response("Not found", { status: 404 });
  }

  try {
    let pdf;
    if (kind === "invoice") pdf = await renderInvoicePdf(numericId);
    else if (kind === "quotation") pdf = await renderQuotationPdf(numericId);
    else if (kind === "receipt") pdf = await renderReceiptPdf(numericId);
    else if (kind === "credit-note") pdf = await renderCreditNotePdf(numericId);
    else if (kind === "delivery-note") pdf = await renderDeliveryNotePdf(numericId);
    else return new Response("Not found", { status: 404 });

    return new Response(new Uint8Array(pdf.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${pdf.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}