"use client";

import { useActionState } from "react";
import { Field, inputClass, PrimaryButton } from "@/components/ui";
import type { SendState } from "@/lib/actions/send";

type SendAction = (prevState: SendState, formData: FormData) => Promise<SendState>;

export default function SendEmailForm({
  action,
  defaultTo,
  buttonLabel,
}: {
  action: SendAction;
  defaultTo?: string | null;
  buttonLabel: string;
}) {
  const [state, formAction, pending] = useActionState<SendState, FormData>(action, { status: "idle" });

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Send to">
        <input
          name="to"
          type="email"
          required
          defaultValue={defaultTo ?? ""}
          className={inputClass}
          placeholder="client@example.com"
        />
      </Field>
      <Field label="Message (optional)">
        <textarea
          name="message"
          rows={3}
          className={inputClass}
          placeholder="A short note to include in the email…"
        />
      </Field>
      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Sending…" : buttonLabel}
      </PrimaryButton>
      {state.status === "success" && <p className="text-sm text-forest">{state.message}</p>}
      {state.status === "error" && <p className="text-sm text-rust">{state.message}</p>}
    </form>
  );
}
