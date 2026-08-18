const COLORS: Record<string, string> = {
  draft: "text-ink-soft",
  sent: "text-forest",
  paid: "text-forest",
  partial: "text-brass",
  overdue: "text-rust",
  cancelled: "text-ink-soft",
  accepted: "text-forest",
  declined: "text-rust",
  expired: "text-ink-soft",
};

export default function StatusStamp({ status }: { status: string }) {
  const color = COLORS[status] ?? "text-ink-soft";
  return <span className={`stamp ${color}`}>{status}</span>;
}
