CREATE TYPE "public"."guardian_consent_status" AS ENUM('pending', 'approved', 'revoked');--> statement-breakpoint
CREATE TABLE "guardian_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"guardian_email" text NOT NULL,
	"status" "guardian_consent_status" DEFAULT 'pending' NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"guardian_name" text,
	"relationship" text,
	"approved_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoke_token_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guardian_consents_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "guardian_consents_revoke_token_hash_unique" UNIQUE("revoke_token_hash")
);
--> statement-breakpoint
ALTER TABLE "guardian_consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "guardian_consents" ADD CONSTRAINT "guardian_consents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guardian_consents_user_idx" ON "guardian_consents" USING btree ("user_id","created_at" DESC NULLS LAST);