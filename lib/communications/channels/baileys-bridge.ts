import type { WhatsAppDriver } from "./whatsapp";

/**
 * WhatsApp provider driver for the local Baileys bridge
 * (see /whatsapp-bridge/index.mjs).
 *
 * The app doesn't ship any WhatsApp provider SDK — instead it POSTs a tiny
 * JSON payload to a locally-running bridge process that is paired to the
 * business number via QR (essentially an always-on WhatsApp Web session).
 * The bridge does the actual delivery and returns a normalised result.
 *
 * Env to enable (with WHATSAPP_PROVIDER=baileys):
 *   WHATSAPP_BRIDGE_URL   e.g. http://localhost:3789
 *   WHATSAPP_BRIDGE_TOKEN optional shared secret, must match the bridge.
 */
const bridgeUrl = (process.env.WHATSAPP_BRIDGE_URL ?? "").replace(/\/+$/, "");
const bridgeToken = process.env.WHATSAPP_BRIDGE_TOKEN ?? "";

/** Normalise a free-form phone number to international digits (defaults to SA). */
function normalizePhone(input: string): string | null {
  let d = String(input).replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  d = d.replace(/\D/g, "");
  if (d.startsWith("0")) d = "27" + d.slice(1);
  else if (d.length === 9) d = "27" + d;
  return /^\d{9,15}$/.test(d) ? d : null;
}

export const baileysBridgeDriver: WhatsAppDriver = {
  name: "baileys",

  isConfigured: () => Boolean(bridgeUrl),

  async send(to: string, body: string, link?: string): Promise<void> {
    if (!bridgeUrl) throw new Error("WHATSAPP_BRIDGE_URL is not set — the bridge process isn't configured.");
    const phone = normalizePhone(to);
    if (!phone) {
      throw new Error(
        `Couldn't understand the WhatsApp number "${to}". Use e.g. +27 61 548 4573 or 27615484573.`
      );
    }

    const res = await fetch(`${bridgeUrl}/send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(bridgeToken ? { authorization: `Bearer ${bridgeToken}` } : {}),
      },
      body: JSON.stringify({ to: phone, body, link }),
      signal: AbortSignal.timeout(60_000),
    });

    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || data.ok !== true) {
      throw new Error(data.error ?? `Bridge refused the message (HTTP ${res.status}).`);
    }
  },
};