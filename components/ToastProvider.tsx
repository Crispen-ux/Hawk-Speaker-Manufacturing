"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Kind = "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  kind: Kind;
}

const ToastContext = createContext<(message: string, kind?: Kind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

function FlashListener() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const flash = searchParams.get("flash");
    if (!flash) return;
    const key = pathname + searchParams.toString();
    if (handledRef.current === key) return;
    handledRef.current = key;
    toast(flash, searchParams.get("flashKind") === "error" ? "error" : "success");
    const qs = new URLSearchParams(searchParams);
    qs.delete("flash");
    qs.delete("flashKind");
    const q = qs.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [searchParams, pathname, router, toast]);

  return null;
}

function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: Kind = "success") => {
      const id = ++idRef.current;
      setItems((prev) => [...prev, { id, message, kind }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-80 flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`toast-enter card-elevated pointer-events-auto flex items-start gap-3 rounded-lg border-l-4 bg-white px-4 py-3 shadow-xl ${
              t.kind === "error" ? "border-rust" : "border-success"
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold text-white ${
                t.kind === "error" ? "bg-rust" : "bg-success"
              }`}
            >
              {t.kind === "error" ? "!" : "✓"}
            </span>
            <p className="flex-1 text-sm leading-snug text-ink">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="font-mono text-xs text-ink-soft hover:text-ink"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <Suspense fallback={null}>
        <FlashListener />
      </Suspense>
    </ToastContext.Provider>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return <ToastHost>{children}</ToastHost>;
}