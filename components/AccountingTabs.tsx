"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/accounting/control", label: "Control centre" },
  { href: "/accounting/chart-of-accounts", label: "Chart of accounts" },
  { href: "/accounting/trial-balance", label: "Trial balance" },
  { href: "/accounting/income-statement", label: "Income statement" },
  { href: "/accounting/balance-sheet", label: "Balance sheet" },
  { href: "/accounting/journal", label: "General journal" },
];

export default function AccountingTabs() {
  const pathname = usePathname();
  return (
    <nav className="mb-8 flex gap-2 overflow-x-auto pb-1">
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return <Link key={l.href} href={l.href} className={`shrink-0 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${active ? "border-navy bg-navy text-paper" : "border-rule text-ink hover:border-navy/40 hover:bg-paper-dim"}`}>{l.label}</Link>;
      })}
    </nav>
  );
}
