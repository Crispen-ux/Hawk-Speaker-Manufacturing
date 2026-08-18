import { cookies } from "next/headers";
import { hmacSign } from "@/lib/crypto-edge";

const COOKIE_NAME = "ledger_session";

function getSecret() {
  return process.env.APP_PASSWORD ?? "";
}

export async function createSession() {
  const sig = await hmacSign("ok", getSecret());
  const token = `ok.${sig}`;
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

export async function isAuthed() {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const [value, sig] = token.split(".");
  if (!value || !sig) return false;
  return (await hmacSign(value, getSecret())) === sig;
}

export function checkPassword(input: string) {
  const expected = getSecret();
  if (!expected) return true; // no password configured, allow through
  return input === expected;
}
