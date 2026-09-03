CREATE TYPE "public"."activity_status" AS ENUM('open', 'done');--> statement-breakpoint
CREATE TYPE "public"."opportunity_stage" AS ENUM('new', 'proposal', 'negotiation', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"stage" "opportunity_stage" DEFAULT 'new' NOT NULL,
	"value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"expected_close_date" date,
	"quotation_id" integer,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_activities" ADD COLUMN "status" "activity_status" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "client_activities" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "client_activities" ADD COLUMN "assigned_to_id" integer;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_activities" ADD CONSTRAINT "client_activities_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;