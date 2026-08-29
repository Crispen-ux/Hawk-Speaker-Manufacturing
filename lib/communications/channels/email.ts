import { sendEmail } from "@/lib/email";
import type { CommunicationChannel } from "./channel";
import type { ChannelSendResult, CommunicationMessage } from "../types";

function escapePlain(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

function isConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export const emailChannel: CommunicationChannel = {
  name: "email",
  isConfigured,

  async send(message: CommunicationMessage): Promise<ChannelSendResult> {
    const to = message.toEmail;
    if (!to) {
      return {
        channel: "email",
        ok: false,
        delivered: false,
        error: "No email address for the recipient; message skipped.",
      };
    }
    if (!isConfigured()) {
      return {
        channel: "email",
        ok: false,
        delivered: false,
        message:
          "Email isn't configured yet. Add RESEND_API_KEY and EMAIL_FROM to send emails.",
      };
    }

    try {
      await sendEmail({
        to,
        subject: message.subject ?? message.type,
        html: message.html ?? escapePlain(message.text),
        attachments: message.attachment
          ? [{ filename: message.attachment.filename, content: message.attachment.contentBase64 }]
          : undefined,
      });
      return { channel: "email", ok: true, delivered: true, message: `Email sent to ${to}.` };
    } catch (e) {
      return {
        channel: "email",
        ok: false,
        delivered: false,
        error: e instanceof Error ? e.message : "Email delivery failed.",
      };
    }
  },
};