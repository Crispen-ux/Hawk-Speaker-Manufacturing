"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export default function ConfirmForm({
  action,
  confirm,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  confirm: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        setBusy(true);
        await action(fd);
      }}
      className={className}
      onSubmit={(e) => {
        if (!confirmed.current) {
          e.preventDefault();
          setOpen(true);
        }
      }}
    >
      {children}
      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-navy/40" onClick={() => setOpen(false)} />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="card-elevated w-full max-w-sm rounded-xl border border-rule bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <h3 className="font-display text-base font-bold text-navy">Delete this?</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{confirm}</p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-rule-strong px-4 py-2 font-mono text-xs uppercase tracking-wide text-ink-soft transition-colors hover:border-ink-soft hover:text-ink"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    confirmed.current = true;
                    setOpen(false);
                    formRef.current?.requestSubmit();
                  }}
                  className="rounded-lg bg-rust px-4 py-2 font-mono text-xs uppercase tracking-wide text-white transition-colors hover:bg-rust/90 disabled:opacity-60"
                >
                  {busy ? "Deleting…" : "Delete anyway"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </form>
  );
}