"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/components/ToastProvider";
import { createAutomation, updateAutomation, toggleAutomation, deleteAutomation } from "@/lib/actions/automation";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Step {
  action: string;
  config: Record<string, string>;
}

interface Condition {
  field: string;
  op: string;
  value: string;
}

interface BuilderState {
  id: number | null;
  name: string;
  description: string;
  trigger: string;
  conditions: Condition[];
  steps: Step[];
  enabled: boolean;
}

interface AutomationRow {
  id: number;
  name: string;
  description: string | null;
  trigger: string;
  conditions: string | null;
  enabled: boolean;
  steps: Array<{ id: number; action: string; config: string | null; sortOrder: number }>;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  runCount: number;
}

interface RunRow {
  id: number;
  automationId: number;
  trigger: string;
  entityNumber: string | null;
  status: string;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  automationName: string;
  steps: Array<{ id: number; action: string; status: string; detail: string | null; sortOrder: number }>;
}

interface Props {
  automations: AutomationRow[];
  runs: RunRow[];
  enabledModules: Record<string, boolean>;
  stats: { active: number; total: number; successful: number; failed: number };
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TRIGGER_LABELS: Record<string, string> = {
  "quotation.created": "Quotation created",
  "quotation.sent": "Quotation sent to customer",
  "quotation.viewed": "Customer views quotation",
  "quotation.approved": "Quotation approved",
  "quotation.declined": "Quotation declined",
  "invoice.created": "Invoice created",
  "invoice.sent": "Invoice sent to customer",
  "invoice.viewed": "Customer views invoice",
  "invoice.overdue": "Invoice becomes overdue",
  "payment.received": "Payment received",
  "purchase_order.approved": "Purchase order approved",
  "expense.approved": "Expense approved",
  "document.expiring": "Document approaching expiry",
  "inventory.low_stock": "Inventory low on stock",
};

const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  "quotation.created": "Fires when a new quotation is saved in the system.",
  "quotation.sent": "Fires when a quotation is emailed or sent to a client.",
  "quotation.viewed": "Fires when a client opens a shared quotation link.",
  "quotation.approved": "Fires when a client approves a quotation through the portal.",
  "quotation.declined": "Fires when a client declines a quotation.",
  "invoice.created": "Fires when a new invoice is generated.",
  "invoice.sent": "Fires when an invoice is emailed or sent to a client.",
  "invoice.viewed": "Fires when a client opens a shared invoice link.",
  "invoice.overdue": "Fires when an invoice passes its due date without payment.",
  "payment.received": "Fires when a payment is recorded against an invoice.",
  "purchase_order.approved": "Fires when a purchase order is approved.",
  "expense.approved": "Fires when an expense claim is approved.",
  "document.expiring": "Fires when a shared document link is about to expire.",
  "inventory.low_stock": "Fires when an item falls below its reorder threshold.",
};

const ACTION_LABELS: Record<string, string> = {
  sendEmail: "Send email",
  sendWhatsApp: "Send WhatsApp",
  createInvoice: "Create invoice",
  convertQuotationToInvoice: "Convert quotation to invoice",
  createNotification: "Notify team",
  setDocumentStatus: "Set document status",
  recordEvent: "Record event",
};

const ACTION_DESCRIPTIONS: Record<string, string> = {
  sendEmail: "Send the document to the customer by email.",
  sendWhatsApp: "Send the document to the customer via WhatsApp.",
  createInvoice: "Create a new invoice from scratch.",
  convertQuotationToInvoice: "Convert the approved quotation into an invoice automatically.",
  createNotification: "Create an internal notification for the team.",
  setDocumentStatus: "Update the status of a document (e.g. mark as paid).",
  recordEvent: "Log an entry in the audit trail.",
};

const OPERATORS: { value: string; label: string }[] = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
  { value: "gt", label: "is greater than" },
  { value: "gte", label: "is at least" },
  { value: "lt", label: "is less than" },
  { value: "lte", label: "is at most" },
  { value: "contains", label: "contains" },
];

const CONDITION_FIELDS = [
  { value: "status", label: "Status" },
  { value: "amount", label: "Amount" },
  { value: "customer", label: "Customer" },
  { value: "supplier", label: "Supplier" },
  { value: "clientId", label: "Client ID" },
];

const PLACEHOLDERS = [
  { key: "clientEmail", label: "Customer email" },
  { key: "clientPhone", label: "Customer phone" },
  { key: "clientName", label: "Customer name" },
  { key: "invoiceNumber", label: "Invoice number" },
  { key: "invoiceId", label: "Invoice ID" },
  { key: "quotationNumber", label: "Quotation number" },
  { key: "number", label: "Document number" },
  { key: "amount", label: "Amount" },
  { key: "companyName", label: "Company name" },
  { key: "dueDate", label: "Due date" },
];

type ActionFieldName = { name: string; label: string; type: "text" | "textarea" | "select"; options?: string[]; placeholder?: string };

const ACTION_FIELDS: Record<string, ActionFieldName[]> = {
  sendEmail: [
    { name: "kind", label: "Document type", type: "select", options: ["invoice", "quotation"] },
    { name: "to", label: "Recipient email", type: "text", placeholder: "{{clientEmail}}" },
  ],
  sendWhatsApp: [
    { name: "kind", label: "Document type", type: "select", options: ["invoice", "quotation"] },
    { name: "to", label: "Recipient phone", type: "text", placeholder: "{{clientPhone}}" },
  ],
  convertQuotationToInvoice: [],
  createNotification: [
    { name: "title", label: "Notification title", type: "text", placeholder: "e.g. Quotation converted" },
    { name: "message", label: "Message", type: "textarea", placeholder: "Invoice {{invoiceNumber}} created from approved quotation." },
  ],
  setDocumentStatus: [
    { name: "kind", label: "Document type", type: "select", options: ["invoice", "quotation", "purchaseOrder", "deliveryNote", "creditNote"] },
    { name: "status", label: "Set status to", type: "text", placeholder: "e.g. paid, sent, approved" },
  ],
  recordEvent: [
    { name: "action", label: "Event name", type: "text", placeholder: "e.g. payment_confirmed" },
    { name: "detail", label: "Details", type: "textarea", placeholder: "Description of the event" },
  ],
  createInvoice: [],
};

const TRIGGER_MODULE_MAP: Record<string, string> = {
  "inventory.low_stock": "inventory",
  "purchase_order.approved": "purchaseOrders",
  "expense.approved": "expenses",
};

const ACTION_MODULE_MAP: Record<string, string> = {
  sendWhatsApp: "whatsapp",
  sendEmail: "email",
  createInvoice: "invoices",
  convertQuotationToInvoice: "invoices",
};

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

interface Template {
  name: string;
  description: string;
  trigger: string;
  conditions: Condition[];
  steps: Step[];
}

const TEMPLATES: Template[] = [
  {
    name: "Quotation → Invoice",
    description: "Convert approved quotations into invoices automatically and notify the customer.",
    trigger: "quotation.approved",
    conditions: [{ field: "status", op: "eq", value: "accepted" }],
    steps: [
      { action: "convertQuotationToInvoice", config: {} },
      { action: "sendEmail", config: { kind: "invoice", to: "{{clientEmail}}" } },
      { action: "createNotification", config: { title: "Quotation converted", message: "Invoice {{invoiceNumber}} created from approved quotation." } },
    ],
  },
  {
    name: "Invoice follow-up",
    description: "When an invoice becomes overdue, email the customer and send a WhatsApp reminder.",
    trigger: "invoice.overdue",
    conditions: [],
    steps: [
      { action: "sendEmail", config: { kind: "invoice", to: "{{clientEmail}}" } },
      { action: "sendWhatsApp", config: { kind: "invoice", to: "{{clientPhone}}" } },
      { action: "createNotification", config: { title: "Invoice overdue", message: "Invoice {{invoiceNumber}} is overdue." } },
    ],
  },
  {
    name: "Payment received",
    description: "Notify the team when a customer payment is received.",
    trigger: "payment.received",
    conditions: [],
    steps: [
      { action: "setDocumentStatus", config: { kind: "invoice", status: "paid" } },
      { action: "createNotification", config: { title: "Payment received", message: "Payment for invoice {{invoiceNumber}} has been recorded." } },
    ],
  },
  {
    name: "Low stock alert",
    description: "Notify when an inventory item falls below its reorder threshold.",
    trigger: "inventory.low_stock",
    conditions: [],
    steps: [
      { action: "createNotification", config: { title: "Low stock", message: "An inventory item is running low." } },
    ],
  },
  {
    name: "Document expiry",
    description: "Notify when a shared document link is approaching expiry.",
    trigger: "document.expiring",
    conditions: [],
    steps: [
      { action: "createNotification", config: { title: "Document expiring", message: "A shared document link is about to expire." } },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function emptyBuilder(): BuilderState {
  return {
    id: null,
    name: "",
    description: "",
    trigger: "quotation.approved",
    conditions: [],
    steps: [{ action: "createNotification", config: { title: "", message: "" } }],
    enabled: true,
  };
}

function builderFromAutomation(a: AutomationRow): BuilderState {
  let conditions: Condition[] = [];
  try {
    if (a.conditions) conditions = JSON.parse(a.conditions);
  } catch { /* ignore */ }
  const steps: Step[] = a.steps.map((s) => {
    let config: Record<string, string> = {};
    try {
      if (s.config) config = JSON.parse(s.config);
    } catch { /* ignore */ }
    return { action: s.action, config };
  });
  return {
    id: a.id,
    name: a.name,
    description: a.description ?? "",
    trigger: a.trigger,
    conditions,
    steps,
    enabled: a.enabled,
  };
}

/* ------------------------------------------------------------------ */
/*  Small UI helpers                                                   */
/* ------------------------------------------------------------------ */

function DropdownMenu({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-md border border-rule-strong px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-paper-dim"
      >
        {label}
      </button>
      {open && (
        <div
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-rule bg-white shadow-xl"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        enabled ? "bg-emerald/10 text-emerald" : "bg-paper-dim text-ink-soft"
      }`}
    >
      {enabled ? "Active" : "Paused"}
    </span>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed"
      ? "bg-emerald/10 text-emerald"
      : status === "failed"
        ? "bg-rust/10 text-rust"
        : "bg-amber-100 text-amber-700";
  const icon = status === "completed" ? "✓" : status === "failed" ? "✕" : "⏳";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}>
      <span>{icon}</span> {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  PlaceholderInsertButton                                            */
/* ------------------------------------------------------------------ */

function PlaceholderInsertButton({ onInsert }: { onInsert: (placeholder: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[11px] font-medium text-forest hover:underline"
      >
        Insert variable ▾
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 w-52 rounded-lg border border-rule bg-white p-1 shadow-xl" onClick={() => setOpen(false)}>
          {PLACEHOLDERS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onInsert(`{{${p.key}}}`)}
              className="block w-full rounded px-2.5 py-1.5 text-left text-xs text-ink hover:bg-paper-dim"
            >
              {p.label} <span className="font-mono text-ink-soft">{`{{${p.key}}}`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StatsCards                                                         */
/* ------------------------------------------------------------------ */

function StatsCards({ stats }: { stats: Props["stats"] }) {
  const items = [
    { label: "Active automations", value: stats.active, color: "text-emerald" },
    { label: "Total runs", value: stats.total, color: "text-ink" },
    { label: "Successful", value: stats.successful, color: "text-emerald" },
    { label: "Failed", value: stats.failed, color: stats.failed > 0 ? "text-rust" : "text-ink" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-rule bg-white px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">{item.label}</div>
          <div className={`mt-1 text-2xl font-bold ${item.color}`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ConditionRow                                                       */
/* ------------------------------------------------------------------ */

function ConditionRow({
  condition,
  index,
  onChange,
  onRemove,
}: {
  condition: Condition;
  index: number;
  onChange: (index: number, condition: Condition) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-paper-dim/40 px-3 py-2">
      <select
        value={condition.field}
        onChange={(e) => onChange(index, { ...condition, field: e.target.value })}
        className="rounded border border-rule bg-white px-2 py-1.5 text-xs"
      >
        {CONDITION_FIELDS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
        <option value="__custom">Custom field…</option>
      </select>
      {condition.field === "__custom" && (
        <input
          value={condition.value}
          onChange={(e) => onChange(index, { ...condition, field: e.target.value })}
          placeholder="field name"
          className="w-28 rounded border border-rule bg-white px-2 py-1.5 text-xs"
        />
      )}
      <select
        value={condition.op}
        onChange={(e) => onChange(index, { ...condition, op: e.target.value })}
        className="rounded border border-rule bg-white px-2 py-1.5 text-xs"
      >
        {OPERATORS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <input
        value={condition.value}
        onChange={(e) => onChange(index, { ...condition, value: e.target.value })}
        placeholder="value"
        className="w-36 rounded border border-rule bg-white px-2 py-1.5 text-xs"
      />
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="rounded px-1.5 py-1 text-xs text-rust hover:bg-rust/10"
        title="Remove condition"
      >
        ✕
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ActionCard                                                         */
/* ------------------------------------------------------------------ */

function ActionCard({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  enabledModules,
}: {
  step: Step;
  index: number;
  total: number;
  onChange: (index: number, step: Step) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  enabledModules: Record<string, boolean>;
}) {
  const fields = ACTION_FIELDS[step.action] ?? [];
  const isModuleDisabled = ACTION_MODULE_MAP[step.action] && enabledModules[ACTION_MODULE_MAP[step.action]] === false;

  const handleConfigChange = useCallback(
    (fieldName: string, value: string) => {
      onChange(index, { ...step, config: { ...step.config, [fieldName]: value } });
    },
    [index, step, onChange],
  );

  return (
    <div className={`rounded-lg border ${isModuleDisabled ? "border-dashed border-ink-soft/30 opacity-50" : "border-forest/20"} bg-paper-dim/30 p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            {index > 0 && (
              <button type="button" onClick={() => onMoveUp(index)} className="text-[10px] text-ink-soft hover:text-ink" title="Move up">▲</button>
            )}
            {index < total - 1 && (
              <button type="button" onClick={() => onMoveDown(index)} className="text-[10px] text-ink-soft hover:text-ink" title="Move down">▼</button>
            )}
          </div>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest/10 text-[11px] font-bold text-forest">
            {index + 1}
          </span>
          <span className="text-sm font-semibold text-ink">{ACTION_LABELS[step.action] ?? step.action}</span>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="rounded px-1.5 py-1 text-xs text-rust hover:bg-rust/10"
          title="Remove action"
        >
          ✕
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-soft">{ACTION_DESCRIPTIONS[step.action]}</p>

      {isModuleDisabled && (
        <p className="mt-2 text-xs text-amber-600">
          This action is unavailable because its module is disabled. Enable it in Settings → Modules to use it.
        </p>
      )}

      {fields.length > 0 && (
        <div className="mt-3 space-y-2">
          {fields.map((f) => (
            <div key={f.name} className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">{f.label}</label>
              {f.type === "select" ? (
                <select
                  value={step.config[f.name] ?? f.options?.[0] ?? ""}
                  onChange={(e) => handleConfigChange(f.name, e.target.value)}
                  className="rounded border border-rule bg-white px-2 py-1.5 text-xs"
                >
                  {f.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <div>
                  <textarea
                    value={step.config[f.name] ?? ""}
                    onChange={(e) => handleConfigChange(f.name, e.target.value)}
                    rows={3}
                    placeholder={f.placeholder}
                    className="w-full rounded border border-rule bg-white px-2.5 py-1.5 text-xs"
                  />
                  <div className="mt-1">
                    <PlaceholderInsertButton onInsert={(ph) => handleConfigChange(f.name, (step.config[f.name] ?? "") + ph)} />
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    value={step.config[f.name] ?? ""}
                    onChange={(e) => handleConfigChange(f.name, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full rounded border border-rule bg-white px-2.5 py-1.5 text-xs"
                  />
                  <div className="mt-1">
                    <PlaceholderInsertButton onInsert={(ph) => handleConfigChange(f.name, (step.config[f.name] ?? "") + ph)} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AutomationCard                                                     */
/* ------------------------------------------------------------------ */

function AutomationCard({
  automation,
  onEdit,
  onDuplicate,
  onResumePause,
  onDelete,
  onViewRuns,
}: {
  automation: AutomationRow;
  onEdit: (a: AutomationRow) => void;
  onDuplicate: (a: AutomationRow) => void;
  onResumePause: (a: AutomationRow) => void;
  onDelete: (a: AutomationRow) => void;
  onViewRuns: (automationId: number) => void;
}) {
  const handleToggle = useCallback(async () => {
    const fd = new FormData();
    fd.set("id", String(automation.id));
    fd.set("enabled", automation.enabled ? "0" : "1");
    await toggleAutomation(fd);
    onResumePause(automation);
  }, [automation, onResumePause]);

  const handleDelete = useCallback(() => {
    if (!window.confirm(`Delete "${automation.name}"? This cannot be undone.`)) return;
    onDelete(automation);
  }, [automation, onDelete]);

  return (
    <div className="rounded-lg border border-rule bg-white p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-bold text-ink">{automation.name}</h3>
            <StatusBadge enabled={automation.enabled} />
          </div>
          {automation.description && (
            <p className="mt-1 text-sm text-ink-soft line-clamp-2">{automation.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-soft">
            <span>
              <span className="font-mono text-[10px] uppercase tracking-wide">When:</span>{" "}
              {TRIGGER_LABELS[automation.trigger] ?? automation.trigger}
            </span>
            <span>
              <span className="font-mono text-[10px] uppercase tracking-wide">Actions:</span>{" "}
              {automation.steps.length}
            </span>
            {automation.runCount > 0 && (
              <>
                <span>Runs: {automation.runCount}</span>
                <span>Last: {automation.lastRunStatus === "completed" ? "✓" : automation.lastRunStatus === "failed" ? "✕" : "⏳"}</span>
                <span>{formatDate(automation.lastRunAt)}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu label="More ▾">
            <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink hover:bg-paper-dim" onClick={() => onEdit(automation)}>
              ✏️ Edit
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink hover:bg-paper-dim" onClick={() => onDuplicate(automation)}>
              📋 Duplicate
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink hover:bg-paper-dim" onClick={handleToggle}>
              {automation.enabled ? "⏸ Pause" : "▶ Resume"}
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink hover:bg-paper-dim" onClick={() => onViewRuns(automation.id)}>
              📊 View runs
            </button>
            <button className="flex w-full items-center gap-2 border-t border-rule px-3 py-2 text-left text-xs text-rust hover:bg-rust/5" onClick={handleDelete}>
              🗑 Delete
            </button>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Run history table                                                  */
/* ------------------------------------------------------------------ */

function RunHistoryTable({
  runs,
  onViewDetail,
}: {
  runs: RunRow[];
  onViewDetail: (run: RunRow) => void;
}) {
  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-rule-strong px-8 py-10 text-center">
        <p className="font-display text-sm font-bold text-ink">No runs yet</p>
        <p className="mt-1 text-xs text-ink-soft">Runs appear here whenever a trigger fires and a workflow processes the event.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-rule">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule bg-paper-dim text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            <th className="px-4 py-2.5 font-medium">Started</th>
            <th className="px-4 py-2.5 font-medium">Workflow</th>
            <th className="px-4 py-2.5 font-medium">Entity</th>
            <th className="px-4 py-2.5 font-medium">Duration</th>
            <th className="px-4 py-2.5 font-medium">Outcome</th>
            <th className="px-4 py-2.5 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-b border-rule last:border-b-0 hover:bg-paper-dim/60">
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-ink-soft">{formatDate(r.startedAt)}</td>
              <td className="px-4 py-2.5 font-medium text-ink">{r.automationName}</td>
              <td className="px-4 py-2.5 text-ink-soft">
                {r.entityNumber ?? <span className="text-ink-soft/50">—</span>}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-ink-soft">{formatDuration(r.durationMs)}</td>
              <td className="px-4 py-2.5"><RunStatusBadge status={r.status} /></td>
              <td className="px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => onViewDetail(r)}
                  className="text-xs font-medium text-forest hover:underline"
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Run detail timeline                                                */
/* ------------------------------------------------------------------ */

function RunDetail({ run, onBack }: { run: RunRow; onBack: () => void }) {
  const sortedSteps = [...run.steps].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="rounded-md border border-rule-strong px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-dim">
          ← Back
        </button>
        <div>
          <h3 className="text-sm font-bold text-ink">Execution timeline</h3>
          <p className="text-xs text-ink-soft">
            {run.automationName} · {TRIGGER_LABELS[run.trigger] ?? run.trigger} · {formatDate(run.startedAt)}
          </p>
        </div>
      </div>

      {run.error && (
        <div className="rounded-lg border border-rust/30 bg-rust/5 p-4 text-sm text-rust">{run.error}</div>
      )}

      <div className="relative ml-3 border-l-2 border-forest/20 pl-6">
        {/* Trigger node */}
        <div className="relative mb-6">
          <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-forest bg-white" />
          <div className="rounded-lg border border-forest/20 bg-forest/5 p-3">
            <span className="font-mono text-[10px] uppercase tracking-wide text-forest">Trigger</span>
            <p className="text-sm font-medium text-ink">{TRIGGER_LABELS[run.trigger] ?? run.trigger}</p>
            <p className="text-xs text-ink-soft">{formatDate(run.startedAt)}</p>
          </div>
        </div>

        {/* Step nodes */}
        {sortedSteps.map((s, i) => {
          const isLast = i === sortedSteps.length - 1;
          const isFailed = s.status === "failed";
          const isSkipped = s.status === "skipped";
          const dotColor = isFailed ? "border-rust bg-rust" : isSkipped ? "border-ink-soft bg-ink-soft" : "border-forest bg-forest";
          const bg = isFailed ? "bg-rust/5" : isSkipped ? "bg-paper-dim" : "bg-white";

          return (
            <div key={s.id} className={`relative ${isLast ? "" : "mb-6"}`}>
              <div className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 ${dotColor}`} />
              <div className={`rounded-lg border border-rule p-3 ${bg}`}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-ink-soft">
                    Step {i + 1}
                  </span>
                  <RunStatusBadge status={s.status} />
                </div>
                <p className="mt-1 text-sm font-medium text-ink">{ACTION_LABELS[s.action] ?? s.action}</p>
                {s.detail && <p className="mt-0.5 text-xs text-ink-soft">{s.detail}</p>}
              </div>
            </div>
          );
        })}

        {/* Completion node */}
        <div className="relative">
          <div className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 ${run.status === "completed" ? "border-emerald bg-emerald" : "border-rust bg-rust"}`} />
          <div className={`rounded-lg border p-3 ${run.status === "completed" ? "border-emerald/20 bg-emerald/5" : "border-rust/20 bg-rust/5"}`}>
            <p className="text-sm font-medium text-ink">
              {run.status === "completed" ? "Workflow completed" : "Workflow failed"}
            </p>
            {run.completedAt && (
              <p className="text-xs text-ink-soft">Duration: {formatDuration(run.durationMs)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function AutomationBuilder({ automations, runs, enabledModules, stats }: Props) {
  const toast = useToast();
  const [view, setView] = useState<"list" | "create" | "edit" | "runs" | "runDetail">("list");
  const [builder, setBuilder] = useState<BuilderState>(emptyBuilder);
  const [selectedRun, setSelectedRun] = useState<RunRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localAutomations, setLocalAutomations] = useState(automations);
  const [localRuns] = useState(runs);
  const [localStats] = useState(stats);

  /* ---- Filter triggers by enabled modules (templates keep known triggers) ---- */
  const availableTriggers = Object.keys(TRIGGER_LABELS).filter((t) => {
    const mod = TRIGGER_MODULE_MAP[t];
    return !mod || enabledModules[mod] !== false;
  });

  /* ---- Builder mutation helpers ---- */
  const updateBuilder = useCallback((patch: Partial<BuilderState>) => {
    setBuilder((prev) => ({ ...prev, ...patch }));
  }, []);

  const addCondition = useCallback(() => {
    setBuilder((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { field: "status", op: "eq", value: "" }],
    }));
  }, []);

  const updateCondition = useCallback((index: number, condition: Condition) => {
    setBuilder((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => (i === index ? condition : c)),
    }));
  }, []);

  const removeCondition = useCallback((index: number) => {
    setBuilder((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  }, []);

  const addAction = useCallback(() => {
    setBuilder((prev) => ({
      ...prev,
      steps: [...prev.steps, { action: "createNotification", config: { title: "", message: "" } }],
    }));
  }, []);

  const updateAction = useCallback((index: number, step: Step) => {
    setBuilder((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === index ? step : s)),
    }));
  }, []);

  const removeAction = useCallback((index: number) => {
    setBuilder((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  }, []);

  const moveAction = useCallback((index: number, direction: -1 | 1) => {
    setBuilder((prev) => {
      const newSteps = [...prev.steps];
      const target = index + direction;
      if (target < 0 || target >= newSteps.length) return prev;
      [newSteps[index], newSteps[target]] = [newSteps[target], newSteps[index]];
      return { ...prev, steps: newSteps };
    });
  }, []);

  /* ---- Submit ---- */
  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("name", builder.name);
      fd.set("description", builder.description);
      fd.set("trigger", builder.trigger);
      fd.set("conditions", JSON.stringify(builder.conditions));
      fd.set("steps", JSON.stringify(builder.steps));
      fd.set("enabled", builder.enabled ? "1" : "0");

      if (builder.id) {
        fd.set("id", String(builder.id));
        await updateAutomation(fd);
        toast("Automation updated.", "success");
      } else {
        await createAutomation(fd);
        toast("Automation created.", "success");
      }
      setView("list");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Something went wrong.", "error");
    } finally {
      setSubmitting(false);
    }
  }, [builder, toast]);

  /* ---- Actions on automation list ---- */
  const handleEdit = useCallback((a: AutomationRow) => {
    setBuilder(builderFromAutomation(a));
    setView("edit");
  }, []);

  const handleDuplicate = useCallback((a: AutomationRow) => {
    const b = builderFromAutomation(a);
    b.id = null;
    b.name = `Copy of ${a.name}`;
    setBuilder(b);
    setView("create");
  }, []);

  const handleDelete = useCallback(async (a: AutomationRow) => {
    try {
      const fd = new FormData();
      fd.set("id", String(a.id));
      await deleteAutomation(fd);
      setLocalAutomations((prev) => prev.filter((x) => x.id !== a.id));
      toast("Automation deleted.", "success");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Delete failed.", "error");
    }
  }, [toast]);

  const handleToggle = useCallback(async (a: AutomationRow) => {
    try {
      const fd = new FormData();
      fd.set("id", String(a.id));
      fd.set("enabled", a.enabled ? "0" : "1");
      await toggleAutomation(fd);
      setLocalAutomations((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled } : x)),
      );
      toast(a.enabled ? "Automation paused." : "Automation resumed.", "success");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Toggle failed.", "error");
    }
  }, [toast]);

  const handleApplyTemplate = useCallback((template: Template) => {
    setBuilder({
      id: null,
      name: template.name,
      description: template.description,
      trigger: template.trigger,
      conditions: [...template.conditions],
      steps: template.steps.map((s) => ({ ...s, config: { ...s.config } })),
      enabled: true,
    });
    setView("create");
  }, []);

  /* ---- View: List ---- */
  if (view === "list") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Workflows</div>
            <h1 className="font-display text-[28px] font-extrabold tracking-tight text-navy">Automation</h1>
            <p className="mt-1 max-w-xl text-sm text-ink-soft">
              Automate repetitive business tasks and keep your invoicing workflow running automatically. Every
              execution is logged for auditing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setBuilder(emptyBuilder()); setView("create"); }}
            className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-navy-2"
          >
            + Create automation
          </button>
        </div>

        {/* Stats */}
        <StatsCards stats={localStats} />

        {/* Automations */}
        <div>
          <h2 className="mb-3 font-display text-lg font-bold text-navy">Workflows</h2>
          {localAutomations.length === 0 ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-dashed border-rule-strong px-8 py-14 text-center">
                <p className="font-display text-lg font-bold text-ink">Automate your business</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
                  Create your first workflow to automatically handle invoices, quotations, payments, inventory and more.
                </p>
                <button
                  type="button"
                  onClick={() => { setBuilder(emptyBuilder()); setView("create"); }}
                  className="mt-5 inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-navy-2"
                >
                  Create your first automation
                </button>
              </div>

              {/* Templates */}
              <div>
                <h3 className="mb-3 font-display text-sm font-bold text-navy">Start from a template</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {TEMPLATES.map((t) => (
                    <div key={t.name} className="rounded-lg border border-rule bg-white p-4 transition-shadow hover:shadow-md">
                      <h4 className="font-display text-sm font-bold text-ink">{t.name}</h4>
                      <p className="mt-1 text-xs text-ink-soft">{t.description}</p>
                      <button
                        type="button"
                        onClick={() => handleApplyTemplate(t)}
                        className="mt-3 rounded-md border border-forest/30 px-3 py-1.5 text-xs font-medium text-forest transition-colors hover:bg-forest/5"
                      >
                        Use template
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {localAutomations.map((a) => (
                <AutomationCard
                  key={a.id}
                  automation={a}
                  onEdit={handleEdit}
                  onDuplicate={handleDuplicate}
                  onResumePause={handleToggle}
                  onDelete={handleDelete}
                  onViewRuns={() => {
                    setSelectedRun(null);
                    setView("runs");
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="mb-3 font-display text-lg font-bold text-navy">Recent activity</h2>
            {localRuns.length > 0 && (
              <button type="button" onClick={() => { setSelectedRun(null); setView("runs"); }} className="text-xs font-medium text-forest hover:underline">
                View all
              </button>
            )}
          </div>
          <RunHistoryTable
            runs={localRuns.slice(0, 5)}
            onViewDetail={(r) => { setSelectedRun(r); setView("runDetail"); }}
          />
        </div>
      </div>
    );
  }

  /* ---- View: Run detail ---- */
  if (view === "runDetail" && selectedRun) {
    return (
      <div className="space-y-6">
        <RunDetail run={selectedRun} onBack={() => setView("list")} />
      </div>
    );
  }

  /* ---- View: All runs ---- */
  if (view === "runs") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setView("list")} className="rounded-md border border-rule-strong px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-dim">
            ← Back
          </button>
          <h1 className="font-display text-2xl font-extrabold text-navy">Run history</h1>
        </div>
        <RunHistoryTable
          runs={localRuns}
          onViewDetail={(r) => { setSelectedRun(r); setView("runDetail"); }}
        />
      </div>
    );
  }

  /* ---- View: Builder (create / edit) ---- */
  const isEditing = view === "edit";

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setView("list")} className="rounded-md border border-rule-strong px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper-dim">
          ← Back
        </button>
        <div>
          <h1 className="font-display text-2xl font-extrabold text-navy">
            {isEditing ? "Edit automation" : "Create automation"}
          </h1>
          <p className="text-xs text-ink-soft">
            Automations run automatically when matching business events occur.
          </p>
        </div>
      </div>

      {/* Name + description */}
      <div className="rounded-lg border border-rule bg-white p-6">
        <h2 className="mb-4 font-display text-sm font-bold text-navy">Details</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Automation name</label>
            <input
              value={builder.name}
              onChange={(e) => updateBuilder({ name: e.target.value })}
              placeholder="e.g. Send invoice after quotation approval"
              className="w-full rounded-md border border-rule-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Description (optional)</label>
            <textarea
              value={builder.description}
              onChange={(e) => updateBuilder({ description: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-rule-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
            />
          </div>
        </div>
      </div>

      {/* WHEN */}
      <div className="rounded-lg border border-forest/30 bg-forest/5 p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-[11px] font-bold text-white">WHEN</span>
          <h2 className="font-display text-sm font-bold text-navy">When something happens</h2>
        </div>
        <select
          value={builder.trigger}
          onChange={(e) => updateBuilder({ trigger: e.target.value })}
          className="w-full rounded-md border border-forest/30 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-forest/15"
        >
          {availableTriggers.map((t) => (
            <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
          ))}
        </select>
        <p className="mt-2 text-xs text-ink-soft">{TRIGGER_DESCRIPTIONS[builder.trigger]}</p>
      </div>

      {/* IF */}
      <div className="rounded-lg border border-rule bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700">IF</span>
          <h2 className="font-display text-sm font-bold text-navy">Conditions</h2>
          <span className="text-xs text-ink-soft">— optional</span>
        </div>
        {builder.conditions.length === 0 ? (
          <p className="mb-3 text-xs text-ink-soft">No conditions — the workflow runs for every matching event.</p>
        ) : (
          <div className="mb-3 space-y-2">
            {builder.conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-[10px] font-bold uppercase text-ink-soft">AND</span>}
                <ConditionRow condition={c} index={i} onChange={updateCondition} onRemove={removeCondition} />
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={addCondition}
          className="rounded-md border border-dashed border-forest/40 px-3 py-1.5 text-xs font-medium text-forest transition-colors hover:bg-forest/5"
        >
          + Add condition
        </button>
      </div>

      {/* Visual flow connector */}
      <div className="flex justify-center">
        <div className="flex flex-col items-center">
          <div className="h-4 w-0.5 bg-forest/30" />
          <span className="text-lg text-forest/40">↓</span>
        </div>
      </div>

      {/* THEN */}
      <div className="rounded-lg border border-forest/30 bg-forest/5 p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-[11px] font-bold text-white">THEN</span>
          <h2 className="font-display text-sm font-bold text-navy">Do these things</h2>
        </div>
        {builder.steps.length === 0 ? (
          <p className="mb-3 text-ink-soft">Add at least one action.</p>
        ) : (
          <div className="mb-3 space-y-3">
            {builder.steps.map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                {i > 0 && (
                  <div className="mt-3 flex w-6 shrink-0 justify-center">
                    <div className="h-full w-0.5 bg-forest/30" />
                  </div>
                )}
                <div className="flex-1">
                  <ActionCard
                    step={s}
                    index={i}
                    total={builder.steps.length}
                    onChange={updateAction}
                    onRemove={removeAction}
                    onMoveUp={(idx) => moveAction(idx, -1)}
                    onMoveDown={(idx) => moveAction(idx, 1)}
                    enabledModules={enabledModules}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={addAction}
          className="rounded-md border border-dashed border-forest/40 px-3 py-1.5 text-xs font-medium text-forest transition-colors hover:bg-forest/5"
        >
          + Add action
        </button>
      </div>

      {/* Advanced mode */}
      <details className="rounded-lg border border-rule bg-white" open={showAdvanced}>
        <summary
          className="cursor-pointer px-6 py-4 font-display text-sm font-bold text-navy"
          onClick={(e) => { e.preventDefault(); setShowAdvanced(!showAdvanced); }}
        >
          Advanced settings (JSON)
        </summary>
        {showAdvanced && (
          <div className="space-y-4 border-t border-rule px-6 py-5">
            <p className="text-xs text-ink-soft">
              Raw JSON configuration for the conditions and steps. Edit with care — invalid JSON will prevent the
              workflow from saving.
            </p>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">Conditions JSON</label>
              <textarea
                value={JSON.stringify(builder.conditions, null, 2)}
                onChange={(e) => {
                  try {
                    updateBuilder({ conditions: JSON.parse(e.target.value) });
                  } catch { /* let user keep typing */ }
                }}
                rows={4}
                className="w-full rounded border border-rule bg-paper-dim/50 p-3 font-mono text-xs text-ink"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">Steps JSON</label>
              <textarea
                value={JSON.stringify(builder.steps, null, 2)}
                onChange={(e) => {
                  try {
                    updateBuilder({ steps: JSON.parse(e.target.value) });
                  } catch { /* let user keep typing */ }
                }}
                rows={6}
                className="w-full rounded border border-rule bg-paper-dim/50 p-3 font-mono text-xs text-ink"
              />
            </div>
          </div>
        )}
      </details>

      {/* Save / Cancel */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !builder.name.trim()}
          className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-navy-2 disabled:opacity-50"
        >
          {submitting ? "Saving…" : isEditing ? "Update automation" : "Create automation"}
        </button>
        <button
          type="button"
          onClick={() => setView("list")}
          className="rounded-md border border-rule-strong px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-paper-dim"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}