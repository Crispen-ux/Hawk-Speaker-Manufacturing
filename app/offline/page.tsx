"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-navy text-paper">
        <WifiOff size={28} strokeWidth={1.75} />
      </div>
      <h1 className="mt-6 font-display text-2xl font-extrabold text-ink">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">
        This page needs a connection. Your saved invoices and clients will be back as soon as you&apos;re
        reconnected.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 rounded-md bg-forest px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-forest-2"
      >
        Try again
      </button>
    </main>
  );
}
