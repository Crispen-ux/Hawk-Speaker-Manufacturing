"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileSignature,
  FileText,
  FileMinus,
  BadgeCheck,
  Receipt,
  Truck,
  ShoppingCart,
  FolderOpen,
  Banknote,
  User,
  Bell,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";

type PortalLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  module: string;
};

export default function PortalNav({
  logoData,
  companyName,
  disabledKeys,
  clientName,
}: {
  logoData?: string | null;
  companyName: string;
  disabledKeys: string[];
  clientName: string;
}) {
  const links: PortalLink[] = [
    { href: "/portal", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
    { href: "/portal/quotations", label: "Quotations", icon: FileSignature, module: "quotations" },
    { href: "/portal/invoices", label: "Invoices", icon: FileText, module: "invoices" },
    { href: "/portal/credit-notes", label: "Credit notes", icon: FileMinus, module: "creditNotes" },
    { href: "/portal/receipts", label: "Receipts", icon: BadgeCheck, module: "receipts" },
    { href: "/portal/statements", label: "Statements", icon: Receipt, module: "statements" },
    { href: "/portal/delivery-notes", label: "Delivery notes", icon: Truck, module: "deliveryNotes" },
    { href: "/portal/purchase-orders", label: "Purchase orders", icon: ShoppingCart, module: "purchaseOrders" },
    { href: "/portal/documents", label: "Documents", icon: FolderOpen, module: "documents" },
    { href: "/portal/payments", label: "Payments", icon: Banknote, module: "payments" },
    { href: "/portal/profile", label: "Profile", icon: User, module: "dashboard" },
    { href: "/portal/notifications", label: "Notifications", icon: Bell, module: "notifications" },
  ];

  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const visible = links.filter((l) => l.module === "dashboard" || !disabledKeys.includes(l.module));

  const logo = logoData || "/cretek-logo-reversed.svg";

  const content = (
    <div className="flex h-full w-64 flex-col bg-navy text-paper">
      <div className="border-b border-white/10 px-6 py-7">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt={companyName} className="h-12 w-auto max-w-[210px] object-contain object-left" />
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-paper/45">Client portal</div>
      </div>
      <div className="border-b border-white/10 px-6 py-3">
        <div className="text-sm font-semibold text-paper">{clientName}</div>
        <div className="text-xs text-paper/45">Signed in securely</div>
      </div>
      <nav className="flex-1 overflow-y-auto space-y-0.5 px-3 py-4">
        {visible.map((l) => {
          const active = l.href === "/portal" ? pathname === "/portal" : pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active ? "bg-white/10 font-medium text-paper" : "text-paper/60 hover:bg-white/5 hover:text-paper/90"
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
          onClick={async () => {
            await fetch("/api/portal/logout", { method: "POST" });
            router.push("/portal/login");
            router.refresh();
          }}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-paper/50 transition-colors hover:bg-white/5 hover:text-paper/90"
        >
          <LogOut size={16} strokeWidth={2} className="text-paper/40" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh shrink-0 md:block">{content}</aside>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-navy px-4 py-3 text-paper md:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-md p-1.5 text-paper/80 hover:bg-white/10">
          <Menu size={22} strokeWidth={2} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt={companyName} className="h-8 w-auto max-w-[160px] object-contain" />
        <div className="w-8" />
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 h-dvh w-64 shadow-2xl">{content}</div>
        </div>
      )}
    </>
  );
}