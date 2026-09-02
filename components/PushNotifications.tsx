"use client";

import { useEffect, useState } from "react";

/**
 * Enables / disables browser push (web notifications) on the Notifications
 * page. Requires a valid VAPID public key (NEXT_PUBLIC_VAPID_PUBLIC_KEY) and a
 * secure context. Each browser that turns this on receives pushes for every
 * in-app notification.
 */

type PushState =
  | "unsupported"
  | "unconfigured"
  | "denied"
  | "idle"
  | "subscribed"
  | "error";

function urlB64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function initialPushState(publicKey: string): PushState {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (!publicKey) return "unconfigured";
  if (Notification.permission === "denied") return "denied";
  return "idle";
}

export default function PushNotifications() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const [state, setState] = useState<PushState>(() => initialPushState(publicKey));

  useEffect(() => {
    if (!(state === "idle" || state === "subscribed" || state === "denied")) return;
    void (async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return;
      const sub = await registration.pushManager.getSubscription();
      setState(sub ? "subscribed" : "idle");
    })();
  }, [state]);

  const enable = async () => {
    try {
      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "idle");
          return;
        }
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey),
      });

      const res = await fetch("/api/notifications/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.toJSON().keys?.p256dh,
            auth: subscription.toJSON().keys?.auth,
          },
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) throw new Error(`Push registration failed (${res.status})`);
      setState("subscribed");
    } catch {
      setState("error");
    }
  };

  const disable = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await fetch("/api/notifications/push-subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub?.endpoint ?? "" }),
      });
      setState("idle");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="rounded-lg border border-rule bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink">Push notifications</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Get alerts on this device as soon as they happen in the app.
          </p>
        </div>
        <Status state={state} onEnable={enable} onDisable={disable} />
      </div>
    </div>
  );
}

function Status({ state, onEnable, onDisable }: { state: PushState; onEnable: () => void; onDisable: () => void }) {
  switch (state) {
    case "subscribed":
      return (
        <button
          onClick={onDisable}
          className="shrink-0 rounded-md border border-rule px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper-dim"
        >
          Turn off
        </button>
      );
    case "denied":
      return (
        <span className="shrink-0 text-xs text-rust">
          Blocked — enable notifications in your browser settings.
        </span>
      );
    case "unsupported":
      return <span className="shrink-0 text-xs text-ink-soft">Not supported in this browser.</span>;
    case "unconfigured":
      return (
        <span className="shrink-0 text-xs text-ink-soft">
          Push isn&apos;t configured — add the VAPID keys in Settings.
        </span>
      );
    case "error":
      return <span className="shrink-0 text-xs text-rust">Something went wrong — try again.</span>;
    default:
      return (
        <button
          onClick={onEnable}
          className="shrink-0 rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-paper hover:bg-navy-2"
        >
          Enable
        </button>
      );
  }
}