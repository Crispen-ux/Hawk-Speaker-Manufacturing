import {
  pgTable,
  serial,
  text,
  varchar,
  numeric,
  date,
  timestamp,
  integer,
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
  email: varchar("email", { length: 256 }),
  phone: varchar("phone", { length: 64 }),
  address: text("address"),
  bankDetails: text("bank_details"),
  defaultTaxRate: numeric("default_tax_rate", { precision: 6, scale: 2 }).default("0").notNull(),
  invoicePrefix: varchar("invoice_prefix", { length: 16 }).default("INV-").notNull(),
  quotationPrefix: varchar("quotation_prefix", { length: 16 }).default("QUO-").notNull(),
  nextInvoiceNumber: integer("next_invoice_number").default(1).notNull(),
  nextQuotationNumber: integer("next_quotation_number").default(1).notNull(),
});

export const clientsRelations = relations(clients, ({ many }) => ({
  invoices: many(invoices),
  quotations: many(quotations),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  items: many(invoiceItems),
  payments: many(payments),
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
