CREATE TABLE "eval_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_at" timestamp DEFAULT now() NOT NULL,
	"passed" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"pass_rate" double precision DEFAULT 0 NOT NULL,
	"failures" jsonb DEFAULT '[]'::jsonb,
	"source" text DEFAULT 'fallback' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "graduate_profile" ADD COLUMN "claim_token" text;--> statement-breakpoint
ALTER TABLE "graduate_profile" ADD COLUMN "claim_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "graduate_profile" ADD COLUMN "claimed_at" timestamp;--> statement-breakpoint
CREATE INDEX "eval_run_run_at_idx" ON "eval_run" USING btree ("run_at");--> statement-breakpoint
ALTER TABLE "graduate_profile" ADD CONSTRAINT "graduate_profile_claim_token_unique" UNIQUE("claim_token");