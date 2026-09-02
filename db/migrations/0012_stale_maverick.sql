CREATE TYPE "public"."client_activity_type" AS ENUM('call', 'note', 'meeting', 'follow_up', 'manual');--> statement-breakpoint
CREATE TYPE "public"."doc_visibility" AS ENUM('internal', 'client', 'both');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."vat_treatment" AS ENUM('standard', 'zero_rated', 'exempt');--> statement-breakpoint
CREATE TABLE "bom_headers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"catalog_item_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bom_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"bom_id" integer NOT NULL,
	"catalog_item_id" integer,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '1' NOT NULL,
	"unit_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"markup" numeric(6, 2) DEFAULT '0' NOT NULL,
	"vat_treatment" "vat_treatment" DEFAULT 'standard' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"type" "client_activity_type" DEFAULT 'manual' NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"document_kind" varchar(32),
	"document_id" integer,
	"auto" boolean DEFAULT false NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_bill_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_bill_id" integer NOT NULL,
	"bom_item_id" integer,
	"catalog_item_id" integer,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '1' NOT NULL,
	"unit_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"vat_treatment" "vat_treatment" DEFAULT 'standard' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(64) NOT NULL,
	"supplier_id" integer NOT NULL,
	"description" varchar(256) NOT NULL,
	"bill_date" date NOT NULL,
	"due_date" date,
	"tax_rate" numeric(6, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "expense_status" DEFAULT 'submitted' NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"paid_date" date,
	"approved_by_id" integer,
	"approved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_bills_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "vat_treatment" "vat_treatment" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "job_card_id" integer;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "status" "expense_status" DEFAULT 'submitted' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "approved_by_id" integer;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "receipt_upload_id" integer;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "vat_treatment" "vat_treatment" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_card_items" ADD COLUMN "vat_treatment" "vat_treatment" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_cards" ADD COLUMN "bom_id" integer;--> statement-breakpoint
ALTER TABLE "job_cards" ADD COLUMN "source_quotation_id" integer;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD COLUMN "vat_treatment" "vat_treatment" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "supplier_bill_prefix" varchar(16) DEFAULT 'SB-' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "next_supplier_bill_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "client_id" integer;--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "category" varchar(64);--> statement-breakpoint
ALTER TABLE "uploads" ADD COLUMN "visibility" "doc_visibility" DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "bom_headers" ADD CONSTRAINT "bom_headers_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_bom_id_bom_headers_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."bom_headers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activities" ADD CONSTRAINT "client_activities_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activities" ADD CONSTRAINT "client_activities_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bill_items" ADD CONSTRAINT "supplier_bill_items_supplier_bill_id_supplier_bills_id_fk" FOREIGN KEY ("supplier_bill_id") REFERENCES "public"."supplier_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bill_items" ADD CONSTRAINT "supplier_bill_items_bom_item_id_bom_items_id_fk" FOREIGN KEY ("bom_item_id") REFERENCES "public"."bom_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bill_items" ADD CONSTRAINT "supplier_bill_items_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_job_card_id_job_cards_id_fk" FOREIGN KEY ("job_card_id") REFERENCES "public"."job_cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_receipt_upload_id_uploads_id_fk" FOREIGN KEY ("receipt_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_bom_id_bom_headers_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."bom_headers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_source_quotation_id_quotations_id_fk" FOREIGN KEY ("source_quotation_id") REFERENCES "public"."quotations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;