import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({ token: "", password: "" }));
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "Invalid reset link." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const rows = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, tokenHash), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
    .limit(1);
  const record = rows[0];
  if (!record) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const userRows = await db.select().from(users).where(eq(users.id, record.userId)).limit(1);
  const user = userRows[0];
  if (!user || !user.active) {
    return NextResponse.json({ error: "This account is no longer active." }, { status: 400 });
  }

  const newHash = hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, record.id));

  return NextResponse.json({ ok: true, message: "Password updated. You can now sign in." });
}
