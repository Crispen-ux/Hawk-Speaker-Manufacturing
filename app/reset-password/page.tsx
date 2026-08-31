"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setSubmitting(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setDone(true);
    } else {
      setError(data.error || "Something went wrong. Try using a fresh reset link.");
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy px-4">
        <div className="w-full max-w-sm rounded-lg border border-white/10 bg-navy-2 p-7 text-center shadow-2xl">
          <p className="text-paper">Your password has been updated.</p>
          <button
            onClick={() => router.push("/login")}
            className="mt-5 w-full rounded-md bg-forest-2 py-2.5 text-sm font-semibold text-navy transition-opacity hover:opacity-90"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy px-4">
        <div className="w-full max-w-sm rounded-lg border border-white/10 bg-navy-2 p-7 text-center shadow-2xl">
          <p className="text-paper/80">This reset link is missing or invalid.</p>
          <Link href="/forgot-password" className="mt-4 block text-sm text-forest-2 hover:underline">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-paper">Choose a new password</h1>
        <p className="mb-6 text-sm text-paper/60">At least 8 characters.</p>
        <form onSubmit={onSubmit} className="rounded-lg border border-white/10 bg-navy-2 p-7 shadow-2xl">
          <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.15em] text-paper/60">
            New password
          </label>
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-white/15 bg-navy px-3 py-2.5 text-paper outline-none focus:border-forest-2"
          />
          <label className="mt-4 mb-2 block font-mono text-[11px] uppercase tracking-[0.15em] text-paper/60">
            Confirm password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-md border border-white/15 bg-navy px-3 py-2.5 text-paper outline-none focus:border-forest-2"
          />
          {error && <p className="mt-3 text-sm text-rust">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full rounded-md bg-forest-2 py-2.5 text-sm font-semibold text-navy transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
