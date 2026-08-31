import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const user = await findUserByEmail(String(email ?? ""));

  // Fall back to legacy shared-password mode only when no users exist yet
  // (first-run bootstrapping) so the app stays usable before an admin is created.
  const userCount = await countUsers();
  if (userCount === 0) {
    if (password === (process.env.APP_PASSWORD ?? "")) {
      await createSession({ id: 0, email: "admin@local", name: "Administrator", role: "admin" });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (!user || !user.active || !verifyPassword(password ?? "", user.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  return NextResponse.json({ ok: true });
}

async function countUsers() {
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema");
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows.length;
}
