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
  confirmed: "text-success",
  received: "text-success",
  open: "text-forest",
  in_progress: "text-forest-2",
  completed: "text-success",
  invoiced: "text-success",
  delivered: "text-success",
};

export default function StatusStamp({ status }: { status: string }) {
  const color = COLORS[status] ?? "text-ink-soft";
  return <span className={`stamp ${color}`}>{status.replace(/_/g, " ")}</span>;
}
