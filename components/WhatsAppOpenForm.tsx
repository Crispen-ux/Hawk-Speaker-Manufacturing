"use client";

import { useMemo, useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { normalizeWaPhone, waMeUrl } from "@/lib/whatsapp-deeplink";

/**
 * Sends documents over WhatsApp with a wa.me deep link — no provider needed.
 * Rendered as a real <a target="_blank"> (not window.open), so pop-up blockers
 * can't swallow it. The number and message are editable; the link updates live.
 * WhatsApp just opens with the message pre-filled — the user presses Send there.
 */
export default function WhatsAppOpenForm({
  defaultPhone,
  message,
  buttonLabel,
}: {
  defaultPhone?: string | null;
  message: string;
  buttonLabel: string;
}) {
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [body, setBody] = useState(message);
  const [notice, setNotice] = useState<string | null>(null);

  const valid = Boolean(normalizeWaPhone(phone));
  const href = useMemo(
    () => (valid ? waMeUrl(phone, body) : "#"),
    [valid, phone, body]
  );

  return (
    <div className="space-y-3">
      <Field label="WhatsApp number">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          className={inputClass}
          placeholder="+27 82 000 0000"
        />
      </Field>
      <Field label="Message">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={9}
          className={inputClass}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={
            valid
              ? () => setNotice("WhatsApp opened with the message pre-filled — just press Send there.")
              : (e) => {
                  e.preventDefault();
                  setNotice("Enter a valid WhatsApp number, e.g. +27 82 000 0000.");
                }
          }
          className="inline-block rounded-md bg-navy px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-navy-2"
        >
          {buttonLabel}
        </a>
        <span className="text-xs text-ink-soft">
          Opens WhatsApp with the message pre-filled — press Send there.
        </span>
      </div>
      {notice && <p className="text-sm text-ink-soft">{notice}</p>}
    </div>
  );
}