import type {
  ChannelName,
  ChannelSendResult,
  CommunicationMessage,
} from "../types";

/**
 * A single pluggable communication channel. Implementations own provider
 * details (API keys, payload shapes, retry rules) and MUST NOT throw — they
 * return a `ChannelSendResult` instead so callers can react gracefully.
 */
export interface CommunicationChannel {
  readonly name: ChannelName;
  /** True when the provider credentials/settings are present. */
  isConfigured(): boolean;
  send(message: CommunicationMessage): Promise<ChannelSendResult>;
}