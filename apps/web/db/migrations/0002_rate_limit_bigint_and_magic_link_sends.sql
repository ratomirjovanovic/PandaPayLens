CREATE TABLE "auth_magic_link_sends" (
	"email_hash" text PRIMARY KEY NOT NULL,
	"window_start" bigint NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_rate_limits" ALTER COLUMN "last_request" SET DATA TYPE bigint;