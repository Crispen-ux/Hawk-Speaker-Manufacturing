"use client";

import { useState } from "react";
import { Field, inputClass, PrimaryButton } from "@/components/ui";
import { normalizeWaPhone, waMeUrl } from "@/lib/whatsapp-deeplink";

/**
 * Opens WhatsApp (Web/app) with a pre-filled, editable message for the
 * recipient's number — no provider required. The user presses Send in
 * WhatsApp; nothing is sent automatically.
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

  function openWhatsApp() {
    if (!normalizeWaPhone(phone)) {
      setNotice("Enter a valid WhatsApp number, e.g. +27 82 000 0000.");
      return;
    }
    window.open(waMeUrl(phone, body), "_blank", "noopener,noreferrer");
    setNotice("WhatsApp opened with the message pre-filled — just press Send there.");
  }

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
        <PrimaryButton type="button" onClick={openWhatsApp}>
          {buttonLabel}
        </PrimaryButton>
        <span className="text-xs text-ink-soft">Opens WhatsApp with the message pre-filled — press Send there.</span>
      </div>
      {notice && <p className="text-sm text-ink-soft">{notice}</p>}
    </div>
  );
}