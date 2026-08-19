const COLORS: Record<string, string> = {
  draft: "text-ink-soft",
  sent: "text-forest",
  paid: "text-success",
  partial: "text-forest-2",
  overdue: "text-rust",
  cancelled: "text-ink-soft",
  accepted: "text-success",
  declined: "text-rust",
  expired: "text-ink-soft",
};

export default function StatusStamp({ status }: { status: string }) {
  const color = COLORS[status] ?? "text-ink-soft";
  return <span className={`stamp ${color}`}>{status}</span>;
}
