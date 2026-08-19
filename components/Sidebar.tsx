"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  FileSignature,
  Repeat,
  Receipt,
  Users,
  Package,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/quotations", label: "Quotations", icon: FileSignature },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/statements", label: "Statements", icon: Receipt },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/catalog", label: "Catalogue", icon: Package },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar({
  logoData,
  companyName,
}: {
  logoData?: string | null;
  companyName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const logoSrc = logoData || "/cretek-logo-reversed.svg";
  const name = companyName || "Cretek Group";

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-navy text-paper">
      <div className="border-b border-white/10 px-6 py-7">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt={name} className="h-8 w-auto max-w-[170px] object-contain object-left" />
        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-paper/45">
          Invoicing &amp; billing
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {links.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-white/10 font-medium text-paper"
                  : "text-paper/60 hover:bg-white/5 hover:text-paper/90"
              }`}
            >
              <Icon size={16} strokeWidth={2} className={active ? "text-forest-2" : "text-paper/40"} />
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-3 py-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-paper/50 transition-colors hover:bg-white/5 hover:text-paper/90"
        >
          <LogOut size={16} strokeWidth={2} className="text-paper/40" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
