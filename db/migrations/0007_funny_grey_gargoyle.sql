CREATE TYPE "public"."journal_entry_kind" AS ENUM('manual', 'opening');--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(64) NOT NULL,
	"date" date NOT NULL,
	"kind" "journal_entry_kind" DEFAULT 'manual' NOT NULL,
	"memo" varchar(256) NOT NULL,
	"reference" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entries_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"journal_entry_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"debit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"memo" varchar(256)
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "journal_prefix" varchar(16) DEFAULT 'JE-' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "next_journal_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;