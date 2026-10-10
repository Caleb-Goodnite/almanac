ALTER TYPE "public"."food_source" ADD VALUE 'common';--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "portions" jsonb;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "category" text;