import { hmacSign } from "@/lib/crypto-edge";

export const COOKIE_NAME = "ledger_session";

export type SessionUser = { id: number; email: string; name: string | null; role: "admin" | "staff" };

function getSecret() {
  return process.env.APP_PASSWORD ?? "";
}

export async function signSessionPayload(payload: string): Promise<string> {
  return `${Buffer.from(payload).toString("base64url")}.${await hmacSign(payload, getSecret())}`;
}

export async function parseSessionToken(token: string | undefined): Promise<SessionUser | null> {
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
