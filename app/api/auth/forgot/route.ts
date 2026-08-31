import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { sendEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({ email: "" }));
  const normalized = String(email ?? "").toLowerCase().trim();
  if (!normalized) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const userRows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  const user = userRows[0];

  // Always return a generic success so we don't leak which emails exist.
  if (user && user.active) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await db.insert(passwordResets).values({ userId: user.id, tokenHash, expiresAt });

    const base = getBaseUrl();
    if (base) {
      const link = `${base}/reset-password?token=${token}`;
      const html = `
        <p>Hi${user.name ? " " + user.name : ""},</p>
        <p>We received a request to reset your password for the invoicing system.</p>
        <p>Click the link below to choose a new password. This link expires in 1 hour.</p>
        <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#064e3b;color:#fff;text-decoration:none;border-radius:6px;">Reset password</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `;
      try {
        await sendEmail({ to: user.email, subject: "Reset your password", html });
      } catch {
        // Email failure should not block the response; admin can still reset.
      }
    }
  }

  return NextResponse.json({
    ok: true,
    message: "If that email is registered, a reset link is on its way.",
  });
}
