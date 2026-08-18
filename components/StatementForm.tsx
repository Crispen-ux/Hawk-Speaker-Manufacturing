"use client";

import { useState } from "react";
import { Field, inputClass, PrimaryButton } from "@/components/ui";

function firstOfYearISO() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type Client = { id: number; name: string; email?: string | null };

export default function StatementForm({ clients }: { clients: Client[] }) {
  const [clientId, setClientId] = useState<number | "">(clients[0]?.id ?? "");
  const [from, setFrom] = useState(firstOfYearISO());
  const [to, setTo] = useState(todayISO());
  const [recipient, setRecipient] = useState(clients[0]?.email ?? "");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const href = clientId ? `/api/statements/pdf/${clientId}?from=${from}&to=${to}` : "#";

  function onClientChange(id: number) {
    setClientId(id);
    const c = clients.find((cl) => cl.id === id);
    setRecipient(c?.email ?? "");
    setResult(null);
  }

  async function onSend() {
    if (!clientId || !recipient) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/statements/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, to: recipient, from, toDate: to }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: `Sent to ${recipient}.` });
      } else {
        setResult({ ok: false, message: data.error || "Something went wrong." });
      }
    } catch {
      setResult({ ok: false, message: "Network error — please try again." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Client">
        <select
          value={clientId}
          onChange={(e) => onClientChange(Number(e.target.value))}
          className={inputClass}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="From">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
        </Field>
        <Field label="To">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-block rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper-dim"
      >
        Preview / download PDF
      </a>

      <div className="border-t border-rule pt-4">
        <Field label="Send to">
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className={inputClass}
            placeholder="client@example.com"
          />
        </Field>
        <div className="mt-3">
          <PrimaryButton type="button" onClick={onSend} disabled={sending || !recipient}>
            {sending ? "Sending…" : "Send statement by email"}
          </PrimaryButton>
        </div>
        {result && (
          <p className={`mt-2 text-sm ${result.ok ? "text-forest" : "text-rust"}`}>{result.message}</p>
        )}
      </div>
    </div>
  );
}
