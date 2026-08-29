import { NextRequest, NextResponse } from "next/server";
import { buildStatementWhatsAppUrl } from "@/lib/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Builds a wa.me deep link for a client statement (message + public link
 * pre-filled) so the statement form can open WhatsApp directly — no provider.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      clientId?: number;
      from?: string;
      toDate?: string;
      phone?: string;
    };
    const clientId = Number(body.clientId ?? 0);
    const from = String(body.from ?? "").trim();
    const toDate = String(body.toDate ?? "").trim();
    const phone = String(body.phone ?? "").trim();

    if (!clientId || !from || !toDate) {
      return NextResponse.json(
        { error: "Client, from and to dates are required." },
        { status: 400 }
      );
    }

    const url = await buildStatementWhatsAppUrl(clientId, from, toDate, phone);
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't build the WhatsApp link." },
      { status: 400 }
    );
  }
}