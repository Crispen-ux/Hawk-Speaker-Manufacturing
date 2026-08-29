"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  FileSignature,
  FileMinus,
  BadgeCheck,
  Repeat,
  Receipt,
  Users,
  Package,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  ShoppingCart,
  Truck,
  Wrench,
  Building2,
  ScrollText,
  Box,
  FolderOpen,
  Briefcase,
  Wallet,
  CalendarDays,
} from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, module: "dashboard", alwaysOn: true },
  { href: "/invoices", label: "Invoices", icon: FileText, module: "invoices" },
  { href: "/quotations", label: "Quotations", icon: FileSignature, module: "quotations" },
  { href: "/recurring", label: "Recurring", icon: Repeat, module: "recurring" },
  { href: "/job-cards", label: "Job cards", icon: Wrench, module: "jobCards" },
  { href: "/delivery-notes", label: "Delivery notes", icon: Truck, module: "deliveryNotes" },
  { href: "/credit-notes", label: "Credit notes", icon: FileMinus, module: "creditNotes" },
  { href: "/receipts", label: "Receipts", icon: BadgeCheck, module: "receipts" },
  { href: "/purchase-orders", label: "Purchase orders", icon: ShoppingCart, module: "purchaseOrders" },
  { href: "/statements", label: "Statements", icon: Receipt, module: "statements" },
  { href: "/clients", label: "Clients", icon: Users, module: "customers" },
  { href: "/suppliers", label: "Suppliers", icon: Building2, module: "suppliers" },
  { href: "/assets", label: "Assets", icon: Box, module: "assets" },
  { href: "/documents", label: "Documents", icon: FolderOpen, module: "documents" },
  { href: "/employees", label: "Employees", icon: Briefcase, module: "employees" },
  { href: "/expenses", label: "Expenses", icon: Wallet, module: "expenses" },
  { href: "/hr", label: "HR", icon: CalendarDays, module: "hr" },
  { href: "/catalog", label: "Catalogue", icon: Package, module: "catalog" },
  { href: "/audit", label: "Audit log", icon: ScrollText, module: "auditLogs" },
  { href: "/settings", label: "Settings", icon: SettingsIcon, module: "settings", alwaysOn: true },
];

function SidebarContent({
  logoSrc,
  name,
  pathname,
  disabledKeys,
  onNavigate,
  onLogout,
}: {
  logoSrc: string;
  name: string;
  pathname: string;
  disabledKeys?: string[];
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const visible = links.filter((l) => l.alwaysOn || !(disabledKeys ?? []).includes(l.module));
  return (
    <div className="flex h-full w-64 flex-col bg-navy text-paper">
      <div className="border-b border-white/10 px-6 py-7">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt={name} className="h-12 w-auto max-w-[210px] object-contain object-left" />
        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-paper/45">
          Invoicing &amp; billing
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto space-y-0.5 px-3 py-4">
        {visible.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={onNavigate}
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
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-paper/50 transition-colors hover:bg-white/5 hover:text-paper/90"
        >
          <LogOut size={16} strokeWidth={2} className="text-paper/40" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({
  logoData,
  companyName,
  disabledKeys = [],
}: {
  logoData?: string | null;
  companyName?: string;
  disabledKeys?: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const logoSrc = logoData || "/cretek-logo-reversed.svg";
  const name = companyName || "Cretek Group";

  return (
    <>
      {/* Desktop rail: pinned to the viewport height, independent of page scroll length */}
      <aside className="sticky top-0 hidden h-dvh shrink-0 md:block">
        <SidebarContent logoSrc={logoSrc} name={name} pathname={pathname} disabledKeys={disabledKeys} onLogout={logout} />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-navy px-4 py-3 text-paper md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-1.5 text-paper/80 hover:bg-white/10"
        >
          <Menu size={22} strokeWidth={2} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt={name} className="h-8 w-auto max-w-[160px] object-contain" />
        <div className="w-8" />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 h-dvh w-64 shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-end border-b border-white/10 bg-navy px-3 py-2">
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="rounded-md p-1.5 text-paper/70 hover:bg-white/10"
                >
                  <X size={20} strokeWidth={2} />
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <SidebarContent
                  logoSrc={logoSrc}
                  name={name}
                  pathname={pathname}
                  disabledKeys={disabledKeys}
                  onNavigate={() => setOpen(false)}
                  onLogout={logout}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
