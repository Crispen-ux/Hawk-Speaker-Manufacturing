"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FolderOpen, LayoutDashboard, Menu, Users } from "lucide-react";

type Item = { href: string; label: string; icon: typeof FileText };

const items: Item[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/documents", label: "Files", icon: FolderOpen },
];

export default function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-navy pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="flex">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-[0.1em] transition-colors ${
                  active ? "text-paper" : "text-paper/50 hover:text-paper/80"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.25 : 1.75} className={active ? "text-forest" : ""} />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onMore}
            aria-label="Open menu"
            className="flex min-h-14 w-full flex-col items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-[0.1em] text-paper/50 transition-colors hover:text-paper/80"
          >
            <Menu size={20} strokeWidth={1.75} />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
