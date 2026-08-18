"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push(params.get("next") || "/");
      router.refresh();
    } else {
      setError("That password isn't right.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-display text-4xl italic text-paper">Ledger</div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.25em] text-paper/50">
            Invoicing &amp; accounts
          </div>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-lg border border-white/10 bg-navy-2 p-7 shadow-2xl"
        >
          <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.15em] text-paper/60">
            Password
          </label>
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-white/15 bg-navy px-3 py-2.5 text-paper outline-none focus:border-brass"
            placeholder="••••••••"
          />
          {error && <p className="mt-2 text-sm text-rust">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-md bg-brass py-2.5 text-sm font-semibold text-navy transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Checking…" : "Open the books"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
