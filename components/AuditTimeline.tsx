import { describeAction } from "@/lib/audit";
import { Card } from "@/components/ui";

type Entry = {
  action: string;
  detail: string | null;
  createdAt: Date;
};

/** Newest-first list of audit events for a single document. */
export default function AuditTimeline({ entries, title = "History" }: { entries: Entry[]; title?: string }) {
  return (
    <Card>
      <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-soft">No events recorded yet.</p>
      ) : (
        <ol className="space-y-3 border-l border-rule pl-4">
          {entries.map((e, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-forest/40" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-ink">{describeAction(e.action)}</span>
                <span className="shrink-0 font-mono text-[10px] text-ink-soft">
                  {e.createdAt.toLocaleString("en-ZA", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {e.detail && <p className="mt-0.5 text-xs text-ink-soft">{e.detail}</p>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}