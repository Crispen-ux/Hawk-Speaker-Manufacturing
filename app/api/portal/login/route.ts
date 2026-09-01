import { NextRequest, NextResponse } from "next/server";
import { findPortalUserByEmail, verifyPortalPassword, createPortalSession } from "@/lib/auth-portal";

// Simple in-memory rate limiter keyed by IP (per-process).
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  rec.count += 1;
  return rec.count > 10;
}

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }

  const { email, password } = await req.json();
  const user = await findPortalUserByEmail(String(email ?? ""));
  if (!user || !user.active) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  if (!verifyPortalPassword(String(password ?? ""), user.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const { db } = await import("@/db");
  const { portalUsers } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  await db.update(portalUsers).set({ lastLoginAt: new Date() }).where(eq(portalUsers.id, user.id));

  await createPortalSession({
    portalUserId: user.id,
    clientId: user.clientId,
    email: user.email,
    name: user.name,
  });

  return NextResponse.json({ ok: true });
}
