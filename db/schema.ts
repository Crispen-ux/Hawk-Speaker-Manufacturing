import {
  pgTable,
  serial,
  text,
  varchar,
  numeric,
  date,
  timestamp,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "paid",
  "partial",
  "overdue",
  "cancelled",
]);

export const quotationStatusEnum = pgEnum("quotation_status", [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
]);

export const recurringFrequencyEnum = pgEnum("recurring_frequency", [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
]);

export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "draft",
  "sent",
  "confirmed",
  "received",
  "cancelled",
]);

export const jobCardStatusEnum = pgEnum("job_card_status", [
  "open",
  "in_progress",
  "completed",
  "invoiced",
  "cancelled",
]);

export const deliveryNoteStatusEnum = pgEnum("delivery_note_status", ["draft", "delivered"]);

export const creditNoteStatusEnum = pgEnum("credit_note_status", [
  "draft",
  "issued",
  "applied",
  "cancelled",
]);

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  email: varchar("email", { length: 256 }),
  phone: varchar("phone", { length: 64 }),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  number: varchar("number", { length: 64 }).notNull().unique(),
  clientId: integer("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date").notNull(),
  status: invoiceStatusEnum("status").default("draft").notNull(),
  taxRate: numeric("tax_rate", { precision: 6, scale: 2 }).default("0").notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  paymentTerms: text("payment_terms"),
  lastSentAt: timestamp("last_sent_at"),
  recurringInvoiceId: integer("recurring_invoice_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id")
    .references(() => invoices.id, { onDelete: "cascade" })
    .notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).default("1").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).default("0").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id")
    .references(() => invoices.id, { onDelete: "cascade" })
    .notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  method: varchar("method", { length: 64 }),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Credit notes ----------
// Credit against a client's account, optionally linked to the invoice it
// reverses. Amounts are stored as positive values (the amount being credited).

export const creditNotes = pgTable("credit_notes", {
  id: serial("id").primaryKey(),
  number: varchar("number", { length: 64 }).notNull().unique(),
  clientId: integer("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  issueDate: date("issue_date").notNull(),
  status: creditNoteStatusEnum("status").default("draft").notNull(),
  taxRate: numeric("tax_rate", { precision: 6, scale: 2 }).default("0").notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  paymentTerms: text("payment_terms"),
  lastSentAt: timestamp("last_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const creditNoteItems = pgTable("credit_note_items", {
  id: serial("id").primaryKey(),
  creditNoteId: integer("credit_note_id")
    .references(() => creditNotes.id, { onDelete: "cascade" })
    .notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).default("1").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).default("0").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

// ---------- Receipts ----------
// One receipt per recorded payment, capturing the payment's "moment" with a
// unique number. Created automatically when a payment is recorded.

export const receipts = pgTable("receipts", {
  id: serial("id").primaryKey(),
  number: varchar("number", { length: 64 }).notNull().unique(),
  paymentId: integer("payment_id")
    .references(() => payments.id, { onDelete: "cascade" })
    .notNull(),
  invoiceId: integer("invoice_id")
    .references(() => invoices.id, { onDelete: "cascade" })
    .notNull(),
  clientId: integer("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  issueDate: date("issue_date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: varchar("method", { length: 64 }),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const creditNotesRelations = relations(creditNotes, ({ one, many }) => ({
  client: one(clients, { fields: [creditNotes.clientId], references: [clients.id] }),
  invoice: one(invoices, { fields: [creditNotes.invoiceId], references: [invoices.id] }),
  items: many(creditNoteItems),
}));

export const creditNoteItemsRelations = relations(creditNoteItems, ({ one }) => ({
  creditNote: one(creditNotes, {
    fields: [creditNoteItems.creditNoteId],
    references: [creditNotes.id],
  }),
}));

export const receiptsRelations = relations(receipts, ({ one }) => ({
  payment: one(payments, { fields: [receipts.paymentId], references: [payments.id] }),
  invoice: one(invoices, { fields: [receipts.invoiceId], references: [invoices.id] }),
  client: one(clients, { fields: [receipts.clientId], references: [clients.id] }),
}));

export const quotations = pgTable("quotations", {
  id: serial("id").primaryKey(),
  number: varchar("number", { length: 64 }).notNull().unique(),
  clientId: integer("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  issueDate: date("issue_date").notNull(),
  expiryDate: date("expiry_date").notNull(),
  status: quotationStatusEnum("status").default("draft").notNull(),
  taxRate: numeric("tax_rate", { precision: 6, scale: 2 }).default("0").notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  paymentTerms: text("payment_terms"),
  lastSentAt: timestamp("last_sent_at"),
  convertedInvoiceId: integer("converted_invoice_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quotationItems = pgTable("quotation_items", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id")
    .references(() => quotations.id, { onDelete: "cascade" })
    .notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).default("1").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).default("0").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  companyName: varchar("company_name", { length: 256 }).default("Your Company").notNull(),
  registrationNumber: text("registration_number"),
  vatNumber: text("vat_number"),
  email: varchar("email", { length: 256 }),
  phone: varchar("phone", { length: 64 }),
  address: text("address"),
  bankDetails: text("bank_details"),
  logoData: text("logo_data"),
  logoDarkData: text("logo_dark_data"),
  currency: varchar("currency", { length: 16 }).default("R").notNull(),
  defaultTaxRate: numeric("default_tax_rate", { precision: 6, scale: 2 }).default("0").notNull(),
  taxIncluded: boolean("tax_included").default(false).notNull(),
  paymentTerms: text("payment_terms"),
  paymentTermsDays: integer("payment_terms_days").default(14).notNull(),
  invoiceFooter: text("invoice_footer"),
  invoicePrefix: varchar("invoice_prefix", { length: 16 }).default("INV-").notNull(),
  quotationPrefix: varchar("quotation_prefix", { length: 16 }).default("QUO-").notNull(),
  purchaseOrderPrefix: varchar("purchase_order_prefix", { length: 16 }).default("PO-").notNull(),
  jobCardPrefix: varchar("job_card_prefix", { length: 16 }).default("JOB-").notNull(),
  deliveryNotePrefix: varchar("delivery_note_prefix", { length: 16 }).default("DN-").notNull(),
  creditNotePrefix: varchar("credit_note_prefix", { length: 16 }).default("CN-").notNull(),
  receiptPrefix: varchar("receipt_prefix", { length: 16 }).default("RCPT-").notNull(),
  nextInvoiceNumber: integer("next_invoice_number").default(1).notNull(),
  nextQuotationNumber: integer("next_quotation_number").default(1).notNull(),
  nextPurchaseOrderNumber: integer("next_purchase_order_number").default(1).notNull(),
  nextJobCardNumber: integer("next_job_card_number").default(1).notNull(),
  nextDeliveryNoteNumber: integer("next_delivery_note_number").default(1).notNull(),
  nextCreditNoteNumber: integer("next_credit_note_number").default(1).notNull(),
  nextReceiptNumber: integer("next_receipt_number").default(1).notNull(),
  emailTemplates: text("email_templates"),
  whatsappTemplates: text("whatsapp_templates"),
});

export const catalogItems = pgTable("catalog_items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  unit: varchar("unit", { length: 32 }),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).default("0").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recurringInvoices = pgTable("recurring_invoices", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  frequency: recurringFrequencyEnum("frequency").default("monthly").notNull(),
  dueInDays: integer("due_in_days").default(14).notNull(),
  taxRate: numeric("tax_rate", { precision: 6, scale: 2 }).default("0").notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  autoSend: boolean("auto_send").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  nextRunDate: date("next_run_date").notNull(),
  lastGeneratedAt: timestamp("last_generated_at"),
  lastInvoiceId: integer("last_invoice_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recurringInvoiceItems = pgTable("recurring_invoice_items", {
  id: serial("id").primaryKey(),
  recurringInvoiceId: integer("recurring_invoice_id")
    .references(() => recurringInvoices.id, { onDelete: "cascade" })
    .notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).default("1").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).default("0").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const recurringInvoicesRelations = relations(recurringInvoices, ({ one, many }) => ({
  client: one(clients, { fields: [recurringInvoices.clientId], references: [clients.id] }),
  items: many(recurringInvoiceItems),
}));

export const recurringInvoiceItemsRelations = relations(recurringInvoiceItems, ({ one }) => ({
  recurringInvoice: one(recurringInvoices, {
    fields: [recurringInvoiceItems.recurringInvoiceId],
    references: [recurringInvoices.id],
  }),
}));
export const clientsRelations = relations(clients, ({ many }) => ({
  invoices: many(invoices),
  quotations: many(quotations),
  recurringInvoices: many(recurringInvoices),
  jobCards: many(jobCards),
  deliveryNotes: many(deliveryNotes),
  creditNotes: many(creditNotes),
  receipts: many(receipts),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  items: many(invoiceItems),
  payments: many(payments),
  creditNotes: many(creditNotes),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}));

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  client: one(clients, { fields: [quotations.clientId], references: [clients.id] }),
  items: many(quotationItems),
}));

export const quotationItemsRelations = relations(quotationItems, ({ one }) => ({
  quotation: one(quotations, { fields: [quotationItems.quotationId], references: [quotations.id] }),
}));

// ---------- Suppliers ----------

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  email: varchar("email", { length: 256 }),
  phone: varchar("phone", { length: 64 }),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
}));

// ---------- Purchase Orders ----------

export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  number: varchar("number", { length: 64 }).notNull().unique(),
  supplierId: integer("supplier_id")
    .references(() => suppliers.id, { onDelete: "cascade" })
    .notNull(),
  issueDate: date("issue_date").notNull(),
  expectedDate: date("expected_date"),
  status: purchaseOrderStatusEnum("status").default("draft").notNull(),
  taxRate: numeric("tax_rate", { precision: 6, scale: 2 }).default("0").notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  lastSentAt: timestamp("last_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id")
    .references(() => purchaseOrders.id, { onDelete: "cascade" })
    .notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).default("1").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).default("0").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [purchaseOrders.supplierId], references: [suppliers.id] }),
  items: many(purchaseOrderItems),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
}));

// ---------- Job Cards ----------

export const jobCards = pgTable("job_cards", {
  id: serial("id").primaryKey(),
  number: varchar("number", { length: 64 }).notNull().unique(),
  clientId: integer("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  technician: varchar("technician", { length: 256 }),
  equipment: varchar("equipment", { length: 256 }),
  status: jobCardStatusEnum("status").default("open").notNull(),
  openedDate: date("opened_date").notNull(),
  completedDate: date("completed_date"),
  taxRate: numeric("tax_rate", { precision: 6, scale: 2 }).default("0").notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  lastSentAt: timestamp("last_sent_at"),
  convertedInvoiceId: integer("converted_invoice_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobCardItems = pgTable("job_card_items", {
  id: serial("id").primaryKey(),
  jobCardId: integer("job_card_id")
    .references(() => jobCards.id, { onDelete: "cascade" })
    .notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).default("1").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).default("0").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const jobCardsRelations = relations(jobCards, ({ one, many }) => ({
  client: one(clients, { fields: [jobCards.clientId], references: [clients.id] }),
  items: many(jobCardItems),
}));

export const jobCardItemsRelations = relations(jobCardItems, ({ one }) => ({
  jobCard: one(jobCards, { fields: [jobCardItems.jobCardId], references: [jobCards.id] }),
}));

// ---------- Delivery Notes ----------

export const deliveryNotes = pgTable("delivery_notes", {
  id: serial("id").primaryKey(),
  number: varchar("number", { length: 64 }).notNull().unique(),
  clientId: integer("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  relatedInvoiceId: integer("related_invoice_id"),
  deliveryDate: date("delivery_date").notNull(),
  status: deliveryNoteStatusEnum("status").default("draft").notNull(),
  deliveredBy: varchar("delivered_by", { length: 256 }),
  receivedBy: varchar("received_by", { length: 256 }),
  notes: text("notes"),
  lastSentAt: timestamp("last_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deliveryNoteItems = pgTable("delivery_note_items", {
  id: serial("id").primaryKey(),
  deliveryNoteId: integer("delivery_note_id")
    .references(() => deliveryNotes.id, { onDelete: "cascade" })
    .notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).default("1").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const deliveryNotesRelations = relations(deliveryNotes, ({ one, many }) => ({
  client: one(clients, { fields: [deliveryNotes.clientId], references: [clients.id] }),
  items: many(deliveryNoteItems),
}));

export const deliveryNoteItemsRelations = relations(deliveryNoteItems, ({ one }) => ({
  deliveryNote: one(deliveryNotes, {
    fields: [deliveryNoteItems.deliveryNoteId],
    references: [deliveryNotes.id],
  }),
}));

// ---------- Asset register ----------
// Company equipment and assets, tracked with a status and book value.

export const assetStatusEnum = pgEnum("asset_status", ["active", "maintenance", "disposed"]);

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  category: varchar("category", { length: 128 }),
  serialNumber: varchar("serial_number", { length: 128 }),
  value: numeric("value", { precision: 14, scale: 2 }).default("0").notNull(),
  purchaseDate: date("purchase_date"),
  status: assetStatusEnum("status").default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Modules ----------
// A row exists only once a module's toggle has been saved in Settings; missing
// rows default to enabled. Keyed by the ModuleDef keys in lib/modules.ts.

export const modules = pgTable("modules", {
  key: varchar("key", { length: 64 }).primaryKey(),
  enabled: boolean("enabled").default(true).notNull(),
});

// ---------- Public document links ----------
// One row per document that has been shared via a public link (used by
// WhatsApp sends). `token` is a random, unguessable id that grants read
// access to a rendered PDF — never the document's numeric id, so documents
// can't be enumerated by guessing.
//
// Generated documents (statements) have no row of their own, so their
// generation parameters are stored here instead of `documentId`.

export const documentLinks = pgTable("document_links", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  kind: varchar("kind", { length: 32 }).notNull(),
  documentId: integer("document_id"),
  clientId: integer("client_id"),
  fromDate: date("from_date"),
  toDate: date("to_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Audit log ----------
// Append-only trail of important actions against documents (created, updated,
// status changed, sent, payment recorded, converted, deleted…).

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  documentKind: varchar("document_kind", { length: 32 }).notNull(),
  documentId: integer("document_id").notNull(),
  documentNumber: varchar("document_number", { length: 64 }),
  action: varchar("action", { length: 40 }).notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
