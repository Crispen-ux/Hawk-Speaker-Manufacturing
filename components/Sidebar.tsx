"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  Layers,
  Bell,
  Banknote,
  Coins,
  BarChart3,
  Landmark,
  UserCog,
  Zap,
  Boxes,
  FileStack,
  Percent,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type NavLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  module: string;
  alwaysOn?: boolean;
  adminOnly?: boolean;
};

type NavSection = {
  id: string;
  label: string;
  links: NavLink[];
  defaultOpen?: boolean;
};

const sections: NavSection[] = [
  {
    id: "overview",
    label: "Overview",
    defaultOpen: true,
    links: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, module: "dashboard", alwaysOn: true },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    defaultOpen: true,
    links: [
      { href: "/invoices", label: "Invoices", icon: FileText, module: "invoices" },
      { href: "/quotations", label: "Quotations", icon: FileSignature, module: "quotations" },
      { href: "/recurring", label: "Recurring invoices", icon: Repeat, module: "recurring" },
      { href: "/credit-notes", label: "Credit notes", icon: FileMinus, module: "creditNotes" },
      { href: "/receipts", label: "Receipts", icon: BadgeCheck, module: "receipts" },
      { href: "/payments", label: "Payments", icon: Banknote, module: "payments" },
      { href: "/statements", label: "Statements", icon: Receipt, module: "statements" },
    ],
  },
  {
    id: "purchasing",
    label: "Purchasing",
    links: [
      { href: "/purchase-orders", label: "Purchase orders", icon: ShoppingCart, module: "purchaseOrders" },
      { href: "/supplier-bills", label: "Supplier bills", icon: FileStack, module: "supplierBills" },
      { href: "/suppliers", label: "Suppliers", icon: Building2, module: "suppliers" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    links: [
      { href: "/job-cards", label: "Job cards", icon: Wrench, module: "jobCards" },
      { href: "/bom", label: "BOM", icon: Boxes, module: "bom" },
      { href: "/delivery-notes", label: "Delivery notes", icon: Truck, module: "deliveryNotes" },
      { href: "/catalog", label: "Catalogue", icon: Package, module: "catalog" },
      { href: "/inventory", label: "Inventory", icon: Layers, module: "inventory" },
      { href: "/assets", label: "Fixed assets", icon: Box, module: "assets" },
      { href: "/documents", label: "Documents", icon: FolderOpen, module: "documents" },
    ],
  },
  {
    id: "people",
    label: "People",
    links: [
      { href: "/clients", label: "Clients", icon: Users, module: "customers" },
      { href: "/employees", label: "Employees", icon: Briefcase, module: "employees" },
      { href: "/expenses", label: "Expenses", icon: Wallet, module: "expenses" },
      { href: "/hr", label: "HR", icon: CalendarDays, module: "hr" },
      { href: "/payroll", label: "Payroll", icon: Coins, module: "payroll" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    defaultOpen: true,
    links: [
      { href: "/accounting", label: "Accounting", icon: Landmark, module: "accounting" },
      { href: "/reports/vat", label: "VAT", icon: Percent, module: "vatReport" },
      { href: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
      { href: "/audit", label: "Audit log", icon: ScrollText, module: "auditLogs" },
    ],
  },
  {
    id: "system",
    label: "System",
    links: [
      { href: "/notifications", label: "Notifications", icon: Bell, module: "notifications" },
      { href: "/users", label: "Users", icon: UserCog, module: "users", adminOnly: true },
      { href: "/automation", label: "Automation", icon: Zap, module: "automation", adminOnly: true },
      { href: "/settings", label: "Settings", icon: SettingsIcon, module: "settings", alwaysOn: true, adminOnly: true },
    ],
  },
];

function SidebarContent({
  logoSrc,
  name,
  pathname,
  disabledKeys,
  role,
  onNavigate,
  onLogout,
}: {
  logoSrc: string;
  name: string;
  pathname: string;
  disabledKeys?: string[];
  role?: "admin" | "staff";
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const visibleSections = useMemo(() => {
    return sections
      .map((section) => ({
        ...section,
        links: section.links.filter(
          (l) =>
            (l.alwaysOn || !(disabledKeys ?? []).includes(l.module)) &&
            (!l.adminOnly || role === "admin")
        ),
      }))
      .filter((section) => section.links.length > 0);
  }, [disabledKeys, role]);

  const activeSection = visibleSections.find((section) =>
    section.links.some((link) =>
      link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)
    )
  )?.id;

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      visibleSections.map((section) => [section.id, section.defaultOpen || section.id === activeSection])
    )
  );

  useEffect(() => {
    if (activeSection) {
      setOpenSections((current) => ({ ...current, [activeSection]: true }));
    }
  }, [activeSection]);

  function toggleSection(id: string) {
    setOpenSections((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <div className="flex h-full w-64 flex-col bg-navy text-paper">
      <div className="border-b border-white/10 px-6 py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt={name} className="h-10 w-auto max-w-[200px] object-contain object-left" />
        <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-paper/40">
          Business management
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {visibleSections.map((section) => {
          const isOpen = openSections[section.id] ?? false;
          const isActive = section.id === activeSection;

          return (
            <div key={section.id} className="mb-1">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                  isActive ? "text-paper/75" : "text-paper/35 hover:text-paper/60"
                }`}
                aria-expanded={isOpen}
              >
                <span>{section.label}</span>
                {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>

              {isOpen && (
                <div className="space-y-0.5 pb-1">
                  {section.links.map((link) => {
                    const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={onNavigate}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors ${
                          active
                            ? "bg-white/10 font-medium text-paper"
                            : "text-paper/55 hover:bg-white/5 hover:text-paper/90"
                        }`}
                      >
                        <Icon
                          size={15}
                          strokeWidth={2}
                          className={active ? "text-forest-2" : "text-paper/35"}
                        />
                        <span className="truncate">{link.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-2 py-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-paper/50 transition-colors hover:bg-white/5 hover:text-paper/90"
        >
          <LogOut size={15} strokeWidth={2} className="text-paper/35" />
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
  role,
}: {
  logoData?: string | null;
  companyName?: string;
  disabledKeys?: string[];
  role?: "admin" | "staff";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
      <aside className="sticky top-0 hidden h-dvh shrink-0 md:block">
        <SidebarContent
          logoSrc={logoSrc}
          name={name}
          pathname={pathname}
          disabledKeys={disabledKeys}
          role={role}
          onLogout={logout}
        />
      </aside>

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
                  role={role}
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
