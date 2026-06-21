CREATE TABLE "rate_limit" (
	"subject" text NOT NULL,
	"route_class" text NOT NULL,
	"window_start" timestamp NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_window_uq" ON "rate_limit" USING btree ("subject","route_class","window_start");--> statement-breakpoint
CREATE INDEX "rate_limit_window_idx" ON "rate_limit" USING btree ("window_start");