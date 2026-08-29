export type ModuleDef = {
  key: string;
  label: string;
  description: string;
  // Top-level route root for a fully built module (sidebar link, nav).
  href?: string;
  // Left-most path segment(s) the module owns, used by the route guard.
  // e.g. "/invoices" covers "/invoices" and "/invoices/3/edit".
  routePrefix?: string;
  // Whether the module has an actual page/area in the app. Unbuilt modules
  // only appear in Settings as "Upcoming" and can't be navigated to.
  built: boolean;
  // Modules that should never be disabled (dashboard, settings).
  alwaysOn?: boolean;
  // Default enabled state for rows that haven't been saved yet.
  enabledByDefault?: boolean;
};

export const MODULES: readonly ModuleDef[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Financial overview, outstanding and overdue balances.",
    href: "/",
    built: true,
    alwaysOn: true,
  },
  {
    key: "customers",
    label: "Customers",
    description: "Client records used by invoices, quotations, job cards and delivery notes.",
    href: "/clients",
    routePrefix: "/clients",
    built: true,
  },
  {
    key: "suppliers",
    label: "Suppliers",
    description: "Vendors used when raising purchase orders.",
    href: "/suppliers",
    routePrefix: "/suppliers",
    built: true,
  },
  {
    key: "catalog",
    label: "Products",
    description: "Catalogue of stock products and services for quick line-item entry.",
    href: "/catalog",
    routePrefix: "/catalog",
    built: true,
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Stock levels and movements per catalogue item.",
    built: false,
  },
  {
    key: "quotations",
    label: "Quotations",
    description: "Quotes for clients that can be converted into invoices.",
    href: "/quotations",
    routePrefix: "/quotations",
    built: true,
  },
  {
    key: "invoices",
    label: "Invoices",
    description: "Billing, payments and email delivery.",
    href: "/invoices",
    routePrefix: "/invoices",
    built: true,
  },
  {
    key: "recurring",
    label: "Recurring invoices",
    description: "Automated invoices on weekly, monthly, quarterly or yearly schedules.",
    href: "/recurring",
    routePrefix: "/recurring",
    built: true,
  },
  {
    key: "purchaseOrders",
    label: "Purchase orders",
    description: "Orders raised against suppliers.",
    href: "/purchase-orders",
    routePrefix: "/purchase-orders",
    built: true,
  },
  {
    key: "statements",
    label: "Statements",
    description: "Per-client account summaries with PDF and email delivery.",
    href: "/statements",
    routePrefix: "/statements",
    built: true,
  },
  {
    key: "payments",
    label: "Payments",
    description: "Record payments against invoices today; a standalone payments area is planned.",
    built: false,
  },
  {
    key: "expenses",
    label: "Expenses",
    description: "Track business outgoings outside of purchase orders.",
    built: false,
  },
  {
    key: "jobCards",
    label: "Jobs & job cards",
    description: "Field jobs tracked per client, convertible into invoices.",
    href: "/job-cards",
    routePrefix: "/job-cards",
    built: true,
  },
  {
    key: "deliveryNotes",
    label: "Delivery notes",
    description: "Record goods or services handed over to clients.",
    href: "/delivery-notes",
    routePrefix: "/delivery-notes",
    built: true,
  },
  {
    key: "employees",
    label: "Employees",
    description: "People directory used by jobs, payroll and HR.",
    built: false,
  },
  {
    key: "payroll",
    label: "Payroll",
    description: "Salaries, wages and payment runs.",
    built: false,
  },
  {
    key: "hr",
    label: "HR",
    description: "Contracts, leave and employee records.",
    built: false,
  },
  {
    key: "assets",
    label: "Assets",
    description: "Company equipment and asset register.",
    href: "/assets",
    routePrefix: "/assets",
    built: true,
  },
  {
    key: "reports",
    label: "Reports",
    description: "Analytics and exportable management reports.",
    built: false,
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "In-app alerts for overdue items and job milestones.",
    built: false,
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    description: "Send invoices and notes over WhatsApp.",
    built: false,
  },
  {
    key: "email",
    label: "Email",
    description: "Outbound email for invoices, quotations, statements and delivery notes (via Resend).",
    built: true,
  },
  {
    key: "documents",
    label: "Documents",
    description: "Central depot of generated PDFs and uploads.",
    href: "/documents",
    routePrefix: "/documents",
    built: true,
  },
  {
    key: "creditNotes",
    label: "Credit notes",
    description: "Refunds and adjustments issued against invoices.",
    href: "/credit-notes",
    routePrefix: "/credit-notes",
    built: true,
  },
  {
    key: "receipts",
    label: "Receipts",
    description: "Acknowledgements for received payments.",
    href: "/receipts",
    routePrefix: "/receipts",
    built: true,
  },
  {
    key: "auditLogs",
    label: "Audit log",
    description: "History of sensitive actions across the system.",
    href: "/audit",
    routePrefix: "/audit",
    built: true,
  },
  {
    key: "settings",
    label: "Settings",
    description: "Company profile, numbering, logos and module toggles.",
    href: "/settings",
    routePrefix: "/settings",
    built: true,
    alwaysOn: true,
  },
];

/** Find the owning module for a given pathname, or undefined for unknown paths. */
export function getModuleForPath(pathname: string): ModuleDef | undefined {
  return MODULES.find((m) => {
    if (!m.routePrefix || !m.built) return false;
    if (m.routePrefix === "/") return pathname === "/";
    return pathname === m.routePrefix || pathname.startsWith(`${m.routePrefix}/`);
  });
}