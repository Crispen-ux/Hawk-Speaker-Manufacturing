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

export default function StatementForm({ clients }: { clients: { id: number; name: string }[] }) {
  const [clientId, setClientId] = useState<number | "">(clients[0]?.id ?? "");
  const [from, setFrom] = useState(firstOfYearISO());
  const [to, setTo] = useState(todayISO());

  const href = clientId ? `/api/statements/pdf/${clientId}?from=${from}&to=${to}` : "#";

  return (
    <div className="space-y-4">
      <Field label="Client">
        <select
          value={clientId}
          onChange={(e) => setClientId(Number(e.target.value))}
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
      <a href={href} target="_blank" rel="noreferrer">
        <PrimaryButton type="button">Generate statement PDF</PrimaryButton>
      </a>
    </div>
  );
}
