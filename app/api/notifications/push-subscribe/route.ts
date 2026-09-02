import { NextRequest, NextResponse } from "next/server";
import { parseSessionToken, COOKIE_NAME } from "@/lib/auth-cookie";
import { savePushSubscription, removePushSubscription } from "@/lib/push";

/**
 * Store / remove a browser's push subscription. Only authenticated internal
 * users may register a device (the session-cookie check is a second layer on
 * top of the proxy's session guard for /api).
 */

export const runtime = "nodejs";

async function authenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return (await parseSessionToken(token)) !== null;
}

export async function POST(req: NextRequest) {
  if (!(await authenticated(req))) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; userAgent?: unknown }
    | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  await savePushSubscription({
    endpoint,
    p256dh,
    auth,
    userAgent: typeof body?.userAgent === "string" ? body.userAgent : undefined,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await authenticated(req))) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  await removePushSubscription(endpoint);
  return NextResponse.json({ ok: true });
}