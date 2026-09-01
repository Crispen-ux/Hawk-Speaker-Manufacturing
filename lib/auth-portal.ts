import { cookies } from "next/headers";
import { hmacSign } from "@/lib/crypto-edge";
import { db } from "@/db";
import { portalUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import crypto from "node:crypto";

/**
 * Client-portal authentication. Portal clients log in with their own email +
 * password (stored in `portal_users`, linked to a client). Sessions are
 * stateless signed cookies that carry the client id plus an expiration, so a
 * token can't live forever and tampering invalidates it immediately.
 *
 * This is deliberately separate from the internal admin/staff session so a
 * client can never piggy-back on an internal account.
 */

export const PORTAL_COOKIE_NAME = "portal_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

export type PortalSession = {
  portalUserId: number;
  clientId: number;
  email: string;
  name: string | null;
};

function getSecret() {
  return process.env.APP_PASSWORD ?? "";
}

// ---------- Password hashing (scrypt, same scheme as internal users) ----------

const SCRYPT_PARAMS = { N: 1 << 15, r: 8, p: 1, keylen: 64 };
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export function hashPortalPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: SCRYPT_MAXMEM,
  });
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${derived.toString("hex")}`;
}

export function verifyPortalPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, , , , salt, hashHex] = parts;
  try {
    const derived = crypto.scryptSync(password, salt, 64, {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
      maxmem: SCRYPT_MAXMEM,
    });
    const a = Buffer.from(hashHex, "hex");
    const b = Buffer.from(derived);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------- Sessions (stateless signed cookie with expiration) ----------

type SessionPayload = PortalSession & { exp: number };

/** Creates (or renews) the portal session cookie for a portal user. */
export async function createPortalSession(session: PortalSession): Promise<void> {
  const payload: SessionPayload = {
    ...session,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const json = JSON.stringify(payload);
  const sig = await hmacSign(json, getSecret());
  const token = `${Buffer.from(json).toString("base64url")}.${sig}`;
  const c = await cookies();
  c.set(PORTAL_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/portal",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroyPortalSession(): Promise<void> {
  const c = await cookies();
  c.delete(PORTAL_COOKIE_NAME);
}

/** Reads + verifies the portal session cookie. Null when absent/invalid/expired. */
export async function sessionPortalUser(): Promise<PortalSession | null> {
  const c = await cookies();
  const token = c.get(PORTAL_COOKIE_NAME)?.value;
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  let json: string;
  try {
    json = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if ((await hmacSign(json, getSecret())) !== sig) return null;
  try {
    const data = JSON.parse(json) as SessionPayload;
    if (!data.clientId || !data.portalUserId) return null;
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null; // expired
    return {
      portalUserId: Number(data.portalUserId),
      clientId: Number(data.clientId),
      email: String(data.email ?? ""),
      name: data.name ? String(data.name) : null,
    };
  } catch {
    return null;
  }
}

/** Loads the portal user row and verifies it is still active + belongs to the client. */
export async function requireActivePortalUser(): Promise<PortalSession> {
  const session = await sessionPortalUser();
  if (!session) redirect("/portal/login");
  const user = await db.query.portalUsers.findFirst({ where: eq(portalUsers.id, session.portalUserId) });
  if (!user || !user.active || user.clientId !== session.clientId) {
    await destroyPortalSession();
    redirect("/portal/login");
  }
  return session;
}

export async function findPortalUserByEmail(email: string) {
  const rows = await db
    .select()
    .from(portalUsers)
    .where(eq(portalUsers.email, email.toLowerCase().trim()))
    .limit(1);
  return rows[0] ?? null;
}

export async function findPortalUserById(id: number) {
  const rows = await db.select().from(portalUsers).where(eq(portalUsers.id, id)).limit(1);
  return rows[0] ?? null;
}
