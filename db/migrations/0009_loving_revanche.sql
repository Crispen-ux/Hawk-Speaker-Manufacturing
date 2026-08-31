ALTER TABLE "clients" ADD COLUMN "registration_number" varchar(64);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "vat_number" varchar(64);--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "registration_number" varchar(64);--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "vat_number" varchar(64);