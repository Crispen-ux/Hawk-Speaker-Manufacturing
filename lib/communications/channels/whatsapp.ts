import type { CommunicationChannel } from "./channel";
import type { ChannelSendResult, CommunicationMessage } from "../types";

/**
 * A WhatsApp provider driver. Implement one per provider (e.g. Twilio,
 * WhatsApp Cloud API) and register it at startup:
 *
 *   registerWhatsAppDriver({
 *     name: "twilio",
 *     isConfigured: () => Boolean(WHATSAPP_PROVIDER... && keys),
 *     send: async (to, body, link) => { await provider.messages.create({...}); },
 *   });
 *
 * Until a driver is registered and `WHATSAPP_PROVIDER` is set, the channel
 * reports itself as not configured and every send is skipped gracefully —
 * nothing throws, so business flows (invoice creation, saves) are unaffected.
 */
export interface WhatsAppDriver {
  name: string;
  isConfigured(): boolean;
  /** Sends a plain-text WhatsApp message. Providers may append `link` as media/doc. */
  send(to: string, body: string, link?: string): Promise<void>;
}

const drivers: Record<string, WhatsAppDriver> = {};

export function registerWhatsAppDriver(driver: WhatsAppDriver): void {
  drivers[driver.name] = driver;
}

function activeDriver(): WhatsAppDriver | null {
  return activeDriverWithReason().driver;
}

/** Returns the active driver, plus a human explanation when there is none. */
function activeDriverWithReason(): {
  driver: WhatsAppDriver | null;
  reason: string | null;
} {
  const provider = process.env.WHATSAPP_PROVIDER;
  if (!provider) {
    return {
      driver: null,
      reason: "WHATSAPP_PROVIDER isn't set — set it to \"baileys\" (and WHATSAPP_BRIDGE_URL) in your env, then restart the server.",
    };
  }
  const driver = drivers[provider];
  if (!driver) {
    return {
      driver: null,
      reason: `WHATSAPP_PROVIDER is "${provider}", but no driver by that name is registered.`,
    };
  }
  if (!driver.isConfigured()) {
    return {
      driver: null,
      reason: `The "${provider}" driver is registered but missing its config env vars.`,
    };
  }
  return { driver, reason: null };
}

function isConfigured(): boolean {
  return activeDriver() !== null;
}

export const whatsappChannel: CommunicationChannel = {
  name: "whatsapp",
  isConfigured,

  async send(message: CommunicationMessage): Promise<ChannelSendResult> {
    const to = message.toPhone;
    if (!to) {
      return {
        channel: "whatsapp",
        ok: false,
        delivered: false,
        error: "No phone number for the recipient; message skipped.",
      };
    }
    const { driver, reason } = activeDriverWithReason();
    if (!driver) {
      return {
        channel: "whatsapp",
        ok: false,
        delivered: false,
        message: `WhatsApp isn't configured yet — ${reason ?? "no provider driver could be activated."} Message skipped; your account is unaffected.`,
      };
    }

    try {
      await driver.send(to, message.text, message.link);
      return { channel: "whatsapp", ok: true, delivered: true, message: `WhatsApp message sent to ${to}.` };
    } catch (e) {
      return {
        channel: "whatsapp",
        ok: false,
        delivered: false,
        error: e instanceof Error ? e.message : "WhatsApp delivery failed.",
      };
    }
  },
};