CREATE TYPE "public"."delivery_note_status" AS ENUM('draft', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."job_card_status" AS ENUM('open', 'in_progress', 'completed', 'invoiced', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('draft', 'sent', 'confirmed', 'received', 'cancelled');--> statement-breakpoint
CREATE TABLE "delivery_note_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"delivery_note_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '1' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(64) NOT NULL,
	"client_id" integer NOT NULL,
	"related_invoice_id" integer,
	"delivery_date" date NOT NULL,
	"status" "delivery_note_status" DEFAULT 'draft' NOT NULL,
	"delivered_by" varchar(256),
	"received_by" varchar(256),
	"notes" text,
	"last_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_notes_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "job_card_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_card_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(64) NOT NULL,
	"client_id" integer NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"technician" varchar(256),
	"equipment" varchar(256),
	"status" "job_card_status" DEFAULT 'open' NOT NULL,
	"opened_date" date NOT NULL,
	"completed_date" date,
	"tax_rate" numeric(6, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"last_sent_at" timestamp,
	"converted_invoice_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "job_cards_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_order_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(64) NOT NULL,
	"supplier_id" integer NOT NULL,
	"issue_date" date NOT NULL,
	"expected_date" date,
	"status" "purchase_order_status" DEFAULT 'draft' NOT NULL,
	"tax_rate" numeric(6, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"last_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"email" varchar(256),
	"phone" varchar(64),
	"address" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "purchase_order_prefix" varchar(16) DEFAULT 'PO-' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "job_card_prefix" varchar(16) DEFAULT 'JOB-' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "delivery_note_prefix" varchar(16) DEFAULT 'DN-' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "next_purchase_order_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "next_job_card_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "next_delivery_note_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_delivery_note_id_delivery_notes_id_fk" FOREIGN KEY ("delivery_note_id") REFERENCES "public"."delivery_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_card_items" ADD CONSTRAINT "job_card_items_job_card_id_job_cards_id_fk" FOREIGN KEY ("job_card_id") REFERENCES "public"."job_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;