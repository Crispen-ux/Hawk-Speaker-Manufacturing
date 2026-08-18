"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard", glyph: "◆" },
  { href: "/invoices", label: "Invoices", glyph: "①" },
  { href: "/quotations", label: "Quotations", glyph: "②" },
  { href: "/statements", label: "Statements", glyph: "③" },
  { href: "/clients", label: "Clients", glyph: "④" },
  { href: "/settings", label: "Settings", glyph: "⑤" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-navy text-paper">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="font-display text-2xl italic tracking-tight text-paper">Ledger</div>
        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper/50">
          Invoicing &amp; accounts
        </div>
      </div>
      <nav className="flex-1 px-3 py-4">
        {links.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-white/10 text-paper font-medium"
                  : "text-paper/60 hover:bg-white/5 hover:text-paper/90"
              }`}
            >
              <span className="font-mono text-xs text-brass">{l.glyph}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-3 py-4">
        <button
          onClick={logout}
          className="w-full rounded-md px-3 py-2 text-left text-sm text-paper/50 transition-colors hover:bg-white/5 hover:text-paper/90"
        >
          ← Sign out
        </button>
      </div>
    </aside>
  );
}
