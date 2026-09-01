"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { portalApproveQuotation, portalDeclineQuotation, portalRequestChanges } from "@/lib/actions/portal";

type ActionState = "idle" | "approve" | "decline" | "changes";

export default function PortalQuotationActions({
  quotationId,
  status,
}: {
  quotationId: number;
  status: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ActionState>("idle");
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function run(fn: (fd: FormData) => Promise<void>) {
    const fd = new FormData();    fd.set("quotationId", String(quotationId));
    if (mode === "approve") fd.set("comment", comment);
    if (mode === "decline") fd.set("reason", reason);
    if (mode === "changes") fd.set("note", note);
    setPending(true);
    try {
      await fn(fd);
      // Server actions redirect; if we return it means no redirect happened.
      router.refresh();
    } catch {
      router.refresh();
    }
  }

  if (status !== "sent") {
    return null;
  }

  return (
    <Card>
      <h3 className="mb-3 font-display text-base font-bold text-navy">Review this quotation</h3>

      {mode === "idle" && (
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => setMode("approve")}
            className="rounded-md bg-forest px-4 py-2 text-sm font-semibold text-paper transition-colors hover:brightness-95"
          >
            Approve quotation
          </button>
          <button
            type="button"
            onClick={() => setMode("decline")}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-red-700"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => setMode("changes")}
            className="rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper-dim"
          >
            Request changes
          </button>
        </div>
      )}

      {mode === "approve" && (
        <form action={() => run(portalApproveQuotation)} className="space-y-4">
          <p className="text-sm text-ink-soft">
            By approving you authorise the company to convert this quotation into an invoice. This will create an
            invoice for the quoted amount.
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment"
            rows={2}
            className="w-full rounded-md border border-rule-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
          />
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="w-full rounded-md bg-forest px-4 py-2 text-sm font-semibold text-paper hover:brightness-95"
            >
              Approve
            </button>
          ) : (
            <div className="space-y-2">
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Please confirm — this will create an invoice. This cannot be undone.
              </p>
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-md bg-forest px-4 py-2 text-sm font-semibold text-paper hover:brightness-95 disabled:opacity-50"
              >
                {pending ? "Approving…" : "Yes, confirm approval"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="w-full rounded-md border border-rule px-4 py-2 text-sm text-ink"
              >
                Back
              </button>
            </div>
          )}
        </form>
      )}

      {mode === "decline" && (
        <form action={() => run(portalDeclineQuotation)} className="space-y-4">
          <textarea
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for declining (required)"
            rows={3}
            className="w-full rounded-md border border-rule-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
          />
          <button
            type="submit"
            disabled={pending || !reason.trim()}
            className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-paper hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Declining…" : "Decline quotation"}
          </button>
          <button type="button" onClick={() => setMode("idle")} className="w-full rounded-md border border-rule px-4 py-2 text-sm text-ink">
            Cancel
          </button>
        </form>
      )}

      {mode === "changes" && (
        <form action={() => run(portalRequestChanges)} className="space-y-4">
          <textarea
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe what you'd like changed (e.g. quantities, prices, dates)"
            rows={3}
            className="w-full rounded-md border border-rule-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
          />
          <button
            type="submit"
            disabled={pending || !note.trim()}
            className="w-full rounded-md bg-navy px-4 py-2 text-sm font-semibold text-paper hover:bg-navy-2 disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Request changes"}
          </button>
          <button type="button" onClick={() => setMode("idle")} className="w-full rounded-md border border-rule px-4 py-2 text-sm text-ink">
            Cancel
          </button>
        </form>
      )}
    </Card>
  );
}