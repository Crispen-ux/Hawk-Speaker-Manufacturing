import type { ChannelName, CommunicationMessage, SendSummary } from "./types";
import type { CommunicationChannel } from "./channels/channel";
import { emailChannel } from "./channels/email";
import { whatsappChannel } from "./channels/whatsapp";
import {
  registerWhatsAppDriver,
  type WhatsAppDriver,
} from "./channels/whatsapp";
import { baileysBridgeDriver } from "./channels/baileys-bridge";
import { getEnabledModules } from "@/lib/enabled-modules";

/**
 * The registry of all channels the application knows about. Adding a new
 * channel (SMS, Telegram…) is just implementing a `CommunicationChannel` and
 * registering it here — nothing in callers changes.
 */
const channels = {
  email: emailChannel,
  whatsapp: whatsappChannel,
} as const satisfies Record<ChannelName, CommunicationChannel>;

/** Module key that gates each channel. A disabled module blocks its channel. */
const channelModules: Record<ChannelName, string> = {
  email: "email",
  whatsapp: "whatsapp",
};

export type {
  ChannelName,
  ChannelSendResult,
  CommunicationMessage,
  MessageType,
  SendSummary,
} from "./types";
export { registerWhatsAppDriver, type WhatsAppDriver } from "./channels/whatsapp";
registerWhatsAppDriver(baileysBridgeDriver);

export function allChannels(): ChannelName[] {
  return Object.keys(channels) as ChannelName[];
}

export function isChannelConfigured(name: ChannelName): boolean {
  return channels[name].isConfigured();
}

export function configuredChannels(): ChannelName[] {
  return allChannels().filter((name) => isChannelConfigured(name));
}

/**
 * Dispatches a message to one or more channels. Every channel runs in
 * isolation: per-channel errors are caught, logged, and folded into the
 * returned summary. THIS FUNCTION NEVER THROWS, so a broken channel can never
 * take down the calling business flow (invoice creation, saves, redirects).
 */
export async function dispatch(
  message: CommunicationMessage,
  options: { channels?: ChannelName[] } = {}
): Promise<SendSummary> {
  const enabled = await getEnabledModules();
  const targets = options.channels ?? allChannels();

  const results = await Promise.all(
    targets.map(async (name): Promise<SendSummary["results"][number]> => {
      const moduleKey = channelModules[name];
      if (moduleKey && enabled[moduleKey] === false) {
        return {
          channel: name,
          ok: false,
          delivered: false,
          error: "This channel is disabled — turn it back on in Settings.",
        };
      }
      try {
        return await channels[name].send(message);
      } catch (e) {
        const error = e instanceof Error ? e.message : "Unexpected channel failure.";
        console.error(`[communications] ${name} channel threw:`, e);
        return { channel: name, ok: false, delivered: false, error };
      }
    })
  );
  return { results, ok: results.some((r) => r.delivered) };
}