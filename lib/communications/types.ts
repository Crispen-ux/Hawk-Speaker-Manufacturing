export type ChannelName = "email" | "whatsapp";

/**
 * The kinds of notifications the communications layer understands. Each maps
 * to a configurable message template. Channels decide how to render them
 * (email renders HTML + attachments; WhatsApp renders a plain-text body,
 * optionally with a document link).
 */
export type MessageType =
  | "invoice"
  | "quotation"
  | "statement"
  | "paymentReminder"
  | "deliveryNotification"
  | "documentLink"
  | "systemNotification";

/**
 * A normalized, channel-agnostic message. Producers (document senders,
 * reminders, cron jobs) build one of these and hand it to `dispatch()` in
 * lib/communications — they never talk to a provider directly.
 */
export type CommunicationMessage = {
  type: MessageType;
  toEmail?: string | null;
  toPhone?: string | null;
  subject?: string;
  /** Plain-text body — the WhatsApp payload, and the email fallback if no html. */
  text: string;
  /** Fully-formed HTML body for email (optional; falls back to escaped text). */
  html?: string;
  attachment?: { filename: string; contentBase64: string };
  /** Public link (e.g. to a document) for WhatsApp document-link messages. */
  link?: string;
  /** Template tokens used to render `text` — kept for auditing/debugging. */
  tokens?: Record<string, string>;
};

export type ChannelSendResult = {
  channel: ChannelName;
  ok: boolean;
  /** True only when the provider accepted a delivery for this channel. */
  delivered: boolean;
  /** User-facing note when nothing was sent (skipped, not configured…). */
  message?: string;
  error?: string;
};

export type SendSummary = {
  results: ChannelSendResult[];
  /** True when at least one configured channel delivered the message. */
  ok: boolean;
};