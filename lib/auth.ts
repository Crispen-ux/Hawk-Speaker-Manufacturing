import { cookies } from "next/headers";
import { hmacSign } from "@/lib/crypto-edge";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

export const COOKIE_NAME = "ledger_session";

export type UserRole = "admin" | "staff";

export type SessionUser = { id: number; email: string; name: string | null; role: UserRole };

function getSecret() {
  return process.env.APP_PASSWORD ?? "";
}

// ---------- Password hashing (scrypt) ----------

const SCRYPT_PARAMS = { N: 1 << 15, r: 8, p: 1, keylen: 64 };
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: SCRYPT_MAXMEM,
  });
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, salt, hashHex] = parts;
  const derived = crypto.scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
    N: parseInt(N, 10),
    r: parseInt(r, 10),
    p: parseInt(p, 10),
    maxmem: SCRYPT_MAXMEM,
  });
  const a = Buffer.from(hashHex, "hex");
  const b = Buffer.from(derived);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Sessions (stateless signed cookies carrying role) ----------

export async function createSession(user: SessionUser) {
  const payload = JSON.stringify({ sub: user.id, email: user.email, name: user.name, role: user.role });
  const sig = await hmacSign(payload, getSecret());
  const token = `${Buffer.from(payload).toString("base64url")}.${sig}`;
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function destroySession() {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

/** Reads + verifies the session cookie. Returns null when absent/invalid. */
export async function sessionUser(): Promise<SessionUser | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if ((await hmacSign(payload, getSecret())) !== sig) return null;
  try {
    const data = JSON.parse(payload);
    if (!data.sub || !data.role) return null;
    return {
      id: Number(data.sub),
      email: String(data.email ?? ""),
      name: data.name ? String(data.name) : null,
      role: data.role === "admin" ? "admin" : "staff",
    };
  } catch {
    return null;
  }
}

export async function isAuthed() {
  return (await sessionUser()) !== null;
}

export async function requireUser(): Promise<SessionUser> {
  const u = await sessionUser();
  if (!u) throw new Error("Not signed in");
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "admin") throw new Error("Admin access required");
  return u;
}

// Backward-compat helpers retained for existing callers (password-only mode).
export async function createSessionLegacy() {
  const token = `ok.${await hmacSign("ok", getSecret())}`;
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function checkPassword(input: string) {
  const expected = getSecret();
  if (!expected) return true;
  return input === expected;
}

// ---------- User helpers ----------

export async function findUserByEmail(email: string) {
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
  return rows[0] ?? null;
}

export async function findUserById(id: number) {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}
