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

export const accountTypeEnum = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
]);

export const journalEntryKindEnum = pgEnum("journal_entry_kind", ["manual", "opening"]);

export const vatTreatmentEnum = pgEnum("vat_treatment", ["standard", "zero_rated", "exempt"]);

export const expenseStatusEnum = pgEnum("expense_status", ["submitted", "approved", "rejected"]);

export const clientActivityTypeEnum = pgEnum("client_activity_type", [
  "call",
  "note",
  "meeting",
  "follow_up",
  "manual",
]);

export const activityStatusEnum = pgEnum("activity_status", ["open", "done"]);

export const opportunityStageEnum = pgEnum("opportunity_stage", [
  "new",
  "proposal",
  "negotiation",
  "won",
  "lost",
]);

export const docVisibilityEnum = pgEnum("doc_visibility", ["internal", "client", "both"]);

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  email: varchar("email", { length: 256 }),
  phone: varchar("phone", { length: 64 }),
  address: text("address"),
  registrationNumber: varchar("registration_number", { length: 64 }),
  vatNumber: varchar("vat_number", { length: 64 }),
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
  // The quotation (if any) this invoice was created from. Preserves the
  // Quotation -> Invoice relationship end-to-end (source traceability).
  sourceQuotationId: integer("source_quotation_id").references(() => quotations.id, {
    onDelete: "set null",
  }),
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
  vatTreatment: vatTreatmentEnum("vat_treatment").default("standard").notNull(),
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
  // Portal approvals — recorded so the decision is tamper-evident and the
  // workflow is idempotent (a quotation can only be approved/declined once).
  approvedAt: timestamp("approved_at"),
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Client portal users ----------
// A login belongs to one client (their organisation/contact). Portal users
// authenticate with an email + password of their own and only ever see
// documents scoped to their client — this is the tenant/isolation boundary.

export const portalUsers = pgTable("portal_users", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  name: varchar("name", { length: 128 }),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").default(true).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const portalUsersRelations = relations(portalUsers, ({ one }) => ({
  client: one(clients, { fields: [portalUsers.clientId], references: [clients.id] }),
}));

export const quotationItems = pgTable("quotation_items", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id")
    .references(() => quotations.id, { onDelete: "cascade" })
    .notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).default("1").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).default("0").notNull(),
  vatTreatment: vatTreatmentEnum("vat_treatment").default("standard").notNull(),
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
  supplierBillPrefix: varchar("supplier_bill_prefix", { length: 16 }).default("SB-").notNull(),
  nextSupplierBillNumber: integer("next_supplier_bill_number").default(1).notNull(),
  journalPrefix: varchar("journal_prefix", { length: 16 }).default("JE-").notNull(),
  nextJournalNumber: integer("next_journal_number").default(1).notNull(),
  emailTemplates: text("email_templates"),
  whatsappTemplates: text("whatsapp_templates"),
  // Email copies of in-app notifications to the company inbox
  // ('off' | 'all' | 'warning').
  emailNotifications: varchar("email_notifications", { length: 16 }).default("all").notNull(),
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
  activities: many(clientActivities),
  opportunities: many(opportunities),
  uploads: many(uploads),
}));

// ---------- Client activity / CRM log ----------
// Timeline of interactions with a client. Entries are created manually
// (calls, meetings, notes, follow-ups) and, where useful, automatically from
// document events (invoices sent, quotations accepted, …). The `document_kind`
// + `document_id` pair links an activity to the document it refers to.
// `auto` records whether the entry was generated from an event vs. typed.

export const clientActivities = pgTable("client_activities", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  type: clientActivityTypeEnum("type").default("manual").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  status: activityStatusEnum("status").default("open").notNull(),
  dueDate: date("due_date"),
  assignedToId: integer("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
  documentKind: varchar("document_kind", { length: 32 }),
  documentId: integer("document_id"),
  auto: boolean("auto").default(false).notNull(),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clientActivitiesRelations = relations(clientActivities, ({ one }) => ({
  client: one(clients, { fields: [clientActivities.clientId], references: [clients.id] }),
  createdBy: one(users, { fields: [clientActivities.createdById], references: [users.id] }),
  assignedTo: one(users, { fields: [clientActivities.assignedToId], references: [users.id] }),
}));

// ---------- Opportunities / deal pipeline ----------
// A sale in progress with a client. Deals track where a quotation sits in the
// sales funnel (new → proposal → negotiation → won/lost) and the expected
// revenue, so the CRM can forecast per client and company-wide.

export const opportunities = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  stage: opportunityStageEnum("stage").default("new").notNull(),
  value: numeric("value", { precision: 12, scale: 2 }).default("0").notNull(),
  expectedCloseDate: date("expected_close_date"),
  quotationId: integer("quotation_id").references(() => quotations.id, { onDelete: "set null" }),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const opportunitiesRelations = relations(opportunities, ({ one }) => ({
  client: one(clients, { fields: [opportunities.clientId], references: [clients.id] }),
  quotation: one(quotations, { fields: [opportunities.quotationId], references: [quotations.id] }),
  createdBy: one(users, { fields: [opportunities.createdById], references: [users.id] }),
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
  registrationNumber: varchar("registration_number", { length: 64 }),
  vatNumber: varchar("vat_number", { length: 64 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
  expenses: many(expenses),
  supplierBills: many(supplierBills),
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
  bomId: integer("bom_id").references(() => bomHeaders.id, { onDelete: "set null" }),
  sourceQuotationId: integer("source_quotation_id").references(() => quotations.id, {
    onDelete: "set null",
  }),
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
  vatTreatment: vatTreatmentEnum("vat_treatment").default("standard").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const jobCardsRelations = relations(jobCards, ({ one, many }) => ({
  client: one(clients, { fields: [jobCards.clientId], references: [clients.id] }),
  items: many(jobCardItems),
  bom: one(bomHeaders, { fields: [jobCards.bomId], references: [bomHeaders.id] }),
  sourceQuotation: one(quotations, {
    fields: [jobCards.sourceQuotationId],
    references: [quotations.id],
  }),
}));

export const jobCardItemsRelations = relations(jobCardItems, ({ one }) => ({
  jobCard: one(jobCards, { fields: [jobCardItems.jobCardId], references: [jobCards.id] }),
}));

// ---------- Bills of Materials ----------
// A BOM is a reusable template or per-job build breakdown. Each line is a
// component/spare that is either linked to a catalogue item or entered as a
// free-text description. Unit cost is the per-unit purchase cost; markup is a
// % added when the BOM is rolled into a quotation/job card/invoice.

export const bomHeaders = pgTable("bom_headers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  // Optional link to the finished product/service (catalogue item).
  catalogItemId: integer("catalog_item_id").references(() => catalogItems.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bomItems = pgTable("bom_items", {
  id: serial("id").primaryKey(),
  bomId: integer("bom_id")
    .references(() => bomHeaders.id, { onDelete: "cascade" })
    .notNull(),
  catalogItemId: integer("catalog_item_id").references(() => catalogItems.id, {
    onDelete: "set null",
  }),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).default("1").notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  // Markup % applied on top of unit cost when the BOM feeds a quote/invoice.
  markup: numeric("markup", { precision: 6, scale: 2 }).default("0").notNull(),
  vatTreatment: vatTreatmentEnum("vat_treatment").default("standard").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const bomHeadersRelations = relations(bomHeaders, ({ one, many }) => ({
  catalogItem: one(catalogItems, {
    fields: [bomHeaders.catalogItemId],
    references: [catalogItems.id],
  }),
  items: many(bomItems),
  jobCards: many(jobCards),
}));

export const bomItemsRelations = relations(bomItems, ({ one, many }) => ({
  bom: one(bomHeaders, { fields: [bomItems.bomId], references: [bomHeaders.id] }),
  catalogItem: one(catalogItems, {
    fields: [bomItems.catalogItemId],
    references: [catalogItems.id],
  }),
  supplierBillItems: many(supplierBillItems),
}));

// ---------- Supplier bills ----------
// A bill/invoice received from a supplier, with a due date and an approval
// workflow (submitted -> approved / rejected). Bills carry input VAT and feed
// the VAT report. Line items can reference the BOM items / spares they
// re-supplied, keeping the job <=> supplier chain traceable.

export const supplierBills = pgTable("supplier_bills", {
  id: serial("id").primaryKey(),
  number: varchar("number", { length: 64 }).notNull().unique(),
  supplierId: integer("supplier_id")
    .references(() => suppliers.id, { onDelete: "cascade" })
    .notNull(),
  description: varchar("description", { length: 256 }).notNull(),
  billDate: date("bill_date").notNull(),
  dueDate: date("due_date"),
  taxRate: numeric("tax_rate", { precision: 6, scale: 2 }).default("0").notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
  status: expenseStatusEnum("status").default("submitted").notNull(),
  paid: boolean("paid").default(false).notNull(),
  paidDate: date("paid_date"),
  approvedById: integer("approved_by_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supplierBillItems = pgTable("supplier_bill_items", {
  id: serial("id").primaryKey(),
  supplierBillId: integer("supplier_bill_id")
    .references(() => supplierBills.id, { onDelete: "cascade" })
    .notNull(),
  bomItemId: integer("bom_item_id").references(() => bomItems.id, { onDelete: "set null" }),
  catalogItemId: integer("catalog_item_id").references(() => catalogItems.id, {
    onDelete: "set null",
  }),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).default("1").notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  vatTreatment: vatTreatmentEnum("vat_treatment").default("standard").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const supplierBillsRelations = relations(supplierBills, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [supplierBills.supplierId], references: [suppliers.id] }),
  items: many(supplierBillItems),
  approvedBy: one(users, { fields: [supplierBills.approvedById], references: [users.id] }),
}));

export const supplierBillItemsRelations = relations(supplierBillItems, ({ one }) => ({
  supplierBill: one(supplierBills, {
    fields: [supplierBillItems.supplierBillId],
    references: [supplierBills.id],
  }),
  bomItem: one(bomItems, {
    fields: [supplierBillItems.bomItemId],
    references: [bomItems.id],
  }),
  catalogItem: one(catalogItems, {
    fields: [supplierBillItems.catalogItemId],
    references: [catalogItems.id],
  }),
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

// ---------- Employees ----------
// People directory linked to job cards, payroll and HR. Salary is stored as a
// currency string so it displays exactly as entered.

export const employeeStatusEnum = pgEnum("employee_status", ["active", "on_leave", "terminated"]);

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name", { length: 128 }).notNull(),
  lastName: varchar("last_name", { length: 128 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  position: varchar("position", { length: 128 }),
  department: varchar("department", { length: 128 }),
  idNumber: varchar("id_number", { length: 32 }),
  startDate: date("start_date"),
  salary: varchar("salary", { length: 64 }).default("0").notNull(),
  status: employeeStatusEnum("status").default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Expenses ----------
// Business outgoings outside of purchase orders. Optionally linked to a
// supplier record; amount kept as a currency string for exact display.

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  description: varchar("description", { length: 256 }).notNull(),
  amount: varchar("amount", { length: 64 }).default("0").notNull(),
  date: date("date").notNull(),
  category: varchar("category", { length: 64 }),
  paymentMethod: varchar("payment_method", { length: 64 }),
  vatTreatment: vatTreatmentEnum("vat_treatment").default("standard").notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  accountId: integer("account_id").references(() => accounts.id, { onDelete: "set null" }),
  jobCardId: integer("job_card_id").references(() => jobCards.id, { onDelete: "set null" }),
  status: expenseStatusEnum("status").default("submitted").notNull(),
  approvedById: integer("approved_by_id").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  receiptUploadId: integer("receipt_upload_id").references(() => uploads.id, {
    onDelete: "set null",
  }),
  reference: varchar("reference", { length: 128 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expensesRelations = relations(expenses, ({ one }) => ({
  supplier: one(suppliers, { fields: [expenses.supplierId], references: [suppliers.id] }),
  account: one(accounts, { fields: [expenses.accountId], references: [accounts.id] }),
  jobCard: one(jobCards, { fields: [expenses.jobCardId], references: [jobCards.id] }),
  approvedBy: one(users, { fields: [expenses.approvedById], references: [users.id] }),
  receiptUpload: one(uploads, { fields: [expenses.receiptUploadId], references: [uploads.id] }),
}));

// ---------- HR: contracts & leave ----------
// Employment contracts and leave requests, both scoped to a single employee.

export const contractTypeEnum = pgEnum("contract_type", ["permanent", "fixed_term", "intern", "part_time"]);

export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .references(() => employees.id, { onDelete: "cascade" })
    .notNull(),
  type: contractTypeEnum("type").default("permanent").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  hourlyRate: varchar("hourly_rate", { length: 64 }).default("0").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leaveStatusEnum = pgEnum("leave_status", ["pending", "approved", "rejected"]);

export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .references(() => employees.id, { onDelete: "cascade" })
    .notNull(),
  type: varchar("type", { length: 32 }).notNull().default("annual"),
  fromDate: date("from_date").notNull(),
  toDate: date("to_date").notNull(),
  days: integer("days").notNull().default(1),
  status: leaveStatusEnum("status").default("pending").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contractsRelations = relations(contracts, ({ one }) => ({
  employee: one(employees, { fields: [contracts.employeeId], references: [employees.id] }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  employee: one(employees, { fields: [leaveRequests.employeeId], references: [employees.id] }),
}));

export const employeesRelations = relations(employees, ({ many }) => ({
  contracts: many(contracts),
  leaveRequests: many(leaveRequests),
  payrollEntries: many(payrollEntries),
}));

// ---------- Inventory movements ----------
// Stock is derived from this ledger: positive delta = in, negative = out.
// Querying and grouping these rows gives stock-on-hand per catalogue item.

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  catalogItemId: integer("catalog_item_id")
    .references(() => catalogItems.id, { onDelete: "cascade" })
    .notNull(),
  deltaQty: numeric("delta_qty", { precision: 12, scale: 2 }).notNull(),
  reason: varchar("reason", { length: 64 }).notNull(),
  reference: varchar("reference", { length: 128 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  item: one(catalogItems, { fields: [inventoryMovements.catalogItemId], references: [catalogItems.id] }),
}));

export const catalogItemsRelations = relations(catalogItems, ({ many }) => ({
  movements: many(inventoryMovements),
}));

// ---------- In-app notifications ----------
// Lightweight alert feed. The notify() helper fires on key events; the
// /notifications page lists them unread-first with mark-read controls.

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  message: text("message"),
  documentKind: varchar("document_kind", { length: 32 }),
  documentId: integer("document_id"),
  level: varchar("level", { length: 16 }).notNull().default("info"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Web push subscriptions ----------
// Browsers that opted in to receiving push notifications. The endpoint + keys
// are what the `web-push` library needs to deliver a notification for an
// event. One row per browser/device.

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});;

// ---------- Payroll ----------
// A run covers a pay period; entries snapshot each employee's salary at run
// time so later salary edits don't rewrite history.

export const payrollStatusEnum = pgEnum("payroll_status", ["draft", "paid"]);

export const payrollRuns = pgTable("payroll_runs", {
  id: serial("id").primaryKey(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  payDate: date("pay_date").notNull(),
  status: payrollStatusEnum("status").default("draft").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payrollEntries = pgTable("payroll_entries", {
  id: serial("id").primaryKey(),
  runId: integer("run_id")
    .references(() => payrollRuns.id, { onDelete: "cascade" })
    .notNull(),
  employeeId: integer("employee_id")
    .references(() => employees.id, { onDelete: "cascade" })
    .notNull(),
  salary: varchar("salary", { length: 64 }).default("0").notNull(),
  additions: varchar("additions", { length: 64 }).default("0").notNull(),
  tax: varchar("tax", { length: 64 }).default("0").notNull(),
  uif: varchar("uif", { length: 64 }).default("0").notNull(),
  otherDeductions: varchar("other_deductions", { length: 64 }).default("0").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payrollRunsRelations = relations(payrollRuns, ({ many }) => ({
  entries: many(payrollEntries),
}));

export const payrollEntriesRelations = relations(payrollEntries, ({ one }) => ({
  run: one(payrollRuns, { fields: [payrollEntries.runId], references: [payrollRuns.id] }),
  employee: one(employees, { fields: [payrollEntries.employeeId], references: [employees.id] }),
}));

// ---------- Document depot uploads ----------
// Files physically stored in the depot (base64 in the row). Generated PDFs
// are rendered on demand and listed on the depot page; anything attached here
// is stored verbatim and downloadable straight from the app.

export const uploads = pgTable("uploads", {
  id: serial("id").primaryKey(),
  label: varchar("label", { length: 256 }).notNull(),
  documentKind: varchar("document_kind", { length: 32 }),
  documentId: integer("document_id"),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
  // Company-document categories: contract, compliance, insurance, finance,
  // other. Free-text string to stay flexible.
  category: varchar("category", { length: 64 }),
  visibility: docVisibilityEnum("visibility").default("internal").notNull(),
  fileName: varchar("file_name", { length: 256 }).notNull(),
  mimeType: varchar("mime_type", { length: 128 }),
  size: integer("size").notNull().default(0),
  data: text("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Modules ----------
// A row exists only once a module's toggle has been saved in Settings; missing
// rows default to enabled. Keyed by the ModuleDef keys in lib/modules.ts.

export const modules = pgTable("modules", {
  key: varchar("key", { length: 64 }).primaryKey(),
  enabled: boolean("enabled").default(true).notNull(),
});

// ---------- Automation engine ----------
// A modular workflow engine. An automation defines a trigger (a business
// event) and a list of steps (actions). When the EventBus emits an event, the
// automation engine evaluates each enabled automation whose trigger matches,
// checks its conditions, then executes its steps in order, recording every
// run and step so the whole lifecycle is auditable and retryable.

export const automationStatusEnum = pgEnum("automation_status", ["run", "failed", "completed"]);

export const automations = pgTable("automations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  // The event that triggers this automation, e.g. "quotation.approved".
  trigger: varchar("trigger", { length: 64 }).notNull(),
  // JSON array of conditions, e.g. [{ field: "status", op: "eq", value: "accepted" }].
  conditions: text("conditions"),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const automationsRelations = relations(automations, ({ many }) => ({
  steps: many(automationSteps),
}));

export const automationSteps = pgTable("automation_steps", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id")
    .references(() => automations.id, { onDelete: "cascade" })
    .notNull(),
  // The action type, e.g. "convertedToInvoice", "sendEmail", "sendWhatsApp", "notify".
  action: varchar("action", { length: 64 }).notNull(),
  // JSON config for the action (channel, template tokens, status, etc.).
  config: text("config"),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const automationStepsRelations = relations(automationSteps, ({ one }) => ({
  automation: one(automations, {
    fields: [automationSteps.automationId],
    references: [automations.id],
  }),
}));

// One row per automation execution (every time a matching event fires).
export const automationRuns = pgTable("automation_runs", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id")
    .references(() => automations.id, { onDelete: "cascade" })
    .notNull(),
  eventId: varchar("event_id", { length: 128 }),
  trigger: varchar("trigger", { length: 64 }).notNull(),
  entityType: varchar("entity_type", { length: 64 }),
  entityId: integer("entity_id"),
  entityNumber: varchar("entity_number", { length: 64 }),
  status: automationStatusEnum("status").default("run").notNull(),
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const automationRunsRelations = relations(automationRuns, ({ one, many }) => ({
  automation: one(automations, {
    fields: [automationRuns.automationId],
    references: [automations.id],
  }),
  steps: many(automationRunSteps),
}));

// Per-step outcome within an automation run, for the execution log.
export const automationRunSteps = pgTable("automation_run_steps", {
  id: serial("id").primaryKey(),
  runId: integer("run_id")
    .references(() => automationRuns.id, { onDelete: "cascade" })
    .notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  status: varchar("status", { length: 16 }).notNull(), // success | failed | skipped
  detail: text("detail"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const automationRunStepsRelations = relations(automationRunSteps, ({ one }) => ({
  run: one(automationRuns, {
    fields: [automationRunSteps.runId],
    references: [automationRuns.id],
  }),
}));

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

// ---------- Accounting: chart of accounts & bank accounts ----------
// The ledger is built by consolidating the app's sub-ledgers (invoices,
// payments, expenses, payroll, purchase orders, assets) into this chart of
// accounts. Accounts marked `isSystem` are driven automatically by those
// sub-ledgers; the rest can be picked when tagging expenses.

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  type: accountTypeEnum("type").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  bankName: varchar("bank_name", { length: 128 }),
  accountNumber: varchar("account_number", { length: 64 }),
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }).default("0").notNull(),
  active: boolean("active").default(true).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accountsRelations = relations(accounts, ({ many }) => ({
  expenses: many(expenses),
  journalLines: many(journalLines),
}));

// ---------- General journal ----------
// Manual double-entry postings that the app's sub-ledgers don't cover (owner
// drawings/contributions, corrections, depreciation). `opening` entries carry
// opening balances and are always included in the ledger regardless of date;
// every entry must post equal debits and credits.

export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  number: varchar("number", { length: 64 }).notNull().unique(),
  date: date("date").notNull(),
  kind: journalEntryKindEnum("kind").default("manual").notNull(),
  memo: varchar("memo", { length: 256 }).notNull(),
  reference: varchar("reference", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const journalLines = pgTable("journal_lines", {
  id: serial("id").primaryKey(),
  journalEntryId: integer("journal_entry_id")
    .references(() => journalEntries.id, { onDelete: "cascade" })
    .notNull(),
  accountId: integer("account_id")
    .references(() => accounts.id, { onDelete: "restrict" })
    .notNull(),
  debit: numeric("debit", { precision: 14, scale: 2 }).default("0").notNull(),
  credit: numeric("credit", { precision: 14, scale: 2 }).default("0").notNull(),
  memo: varchar("memo", { length: 256 }),
});

export const journalEntriesRelations = relations(journalEntries, ({ many }) => ({
  lines: many(journalLines),
}));

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  entry: one(journalEntries, {
    fields: [journalLines.journalEntryId],
    references: [journalEntries.id],
  }),
  account: one(accounts, {
    fields: [journalLines.accountId],
    references: [accounts.id],
  }),
}));

// ---------- Auth: users, roles & password resets ----------

export const userRoleEnum = pgEnum("user_role", ["admin", "staff"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  name: varchar("name", { length: 128 }),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").default("staff").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const passwordResets = pgTable("password_resets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  resets: many(passwordResets),
  approvedExpenses: many(expenses),
  approvedSupplierBills: many(supplierBills),
  createdActivities: many(clientActivities),
}));

export const passwordResetsRelations = relations(passwordResets, ({ one }) => ({
  user: one(users, {
    fields: [passwordResets.userId],
    references: [users.id],
  }),
}));
