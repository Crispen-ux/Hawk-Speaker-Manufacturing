import Link from "next/link";

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4 border-b border-rule pb-5">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
          {eyebrow}
        </div>
        <h1 className="font-display text-[28px] font-extrabold tracking-tight text-navy">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md bg-navy px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-navy-2 disabled:opacity-50 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-block rounded-md bg-navy px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-navy-2"
    >
      {children}
    </Link>
  );
}

export function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-block rounded-md border border-rule-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper-dim"
    >
      {children}
    </Link>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`card-elevated rounded-lg border border-rule bg-white p-6 ${className}`}>{children}</div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-rule-strong px-8 py-14 text-center">
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      {hint && <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-rule-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15";
