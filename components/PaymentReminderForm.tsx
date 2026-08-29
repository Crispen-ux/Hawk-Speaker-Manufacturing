"use client";

import { useActionState } from "react";
import { Field, inputClass, PrimaryButton } from "@/components/ui";
import type { SendState } from "@/lib/actions/send";

type SendAction = (prevState: SendState, formData: FormData) => Promise<SendState>;

/**
 * Sends a payment reminder over email and/or WhatsApp (both optional, picked
 * per-recipient). WhatsApp delivery failures never block the email — the
 * service layer folds them into a per-channel summary.
 */
export default function PaymentReminderForm({
  action,
  defaultEmail,
  defaultPhone,
}: {
  action: SendAction;
  defaultEmail?: string | null;
  defaultPhone?: string | null;
}) {
  const [state, formAction, pending] = useActionState<SendState, FormData>(action, { status: "idle" });

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Email">
        <input
          name="to"
          type="email"
          defaultValue={defaultEmail ?? ""}
          className={inputClass}
          placeholder="client@example.com"
        />
      </Field>
      <Field label="WhatsApp number (optional)">
        <input
          name="toPhone"
          type="tel"
          defaultValue={defaultPhone ?? ""}
          className={inputClass}
          placeholder="+27 82 000 0000"
        />
      </Field>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send payment reminder"}
      </PrimaryButton>
      {state.status === "success" && <p className="text-sm text-forest">{state.message}</p>}
      {state.status === "error" && <p className="text-sm text-rust">{state.message}</p>}
    </form>
  );
}