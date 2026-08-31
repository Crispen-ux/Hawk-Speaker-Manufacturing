"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMessage(null);
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSending(false);
    const data = await res.json().catch(() => ({}));
    setMessage(data.message || "Request submitted.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-paper">Forgot your password?</h1>
        <p className="mb-6 text-sm text-paper/60">
          Enter the email you use to sign in and we&apos;ll send you a reset link.
        </p>
        <form onSubmit={onSubmit} className="rounded-lg border border-white/10 bg-navy-2 p-7 shadow-2xl">
          <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.15em] text-paper/60">
            Email
          </label>
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-white/15 bg-navy px-3 py-2.5 text-paper outline-none focus:border-forest-2"
            placeholder="you@company.com"
          />
          {message && <p className="mt-3 text-sm text-forest-2">{message}</p>}
          <button
            type="submit"
            disabled={sending}
            className="mt-5 w-full rounded-md bg-forest-2 py-2.5 text-sm font-semibold text-navy transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send reset link"}
          </button>
          <div className="mt-4 text-center">
            <Link href="/login" className="text-xs text-paper/50 hover:text-paper/80">
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
