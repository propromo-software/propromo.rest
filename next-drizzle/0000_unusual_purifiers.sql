-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE IF NOT EXISTS "User" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"active_expires" bigint NOT NULL,
	"idle_expires" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Key" (
	"id" text PRIMARY KEY NOT NULL,
	"hashed_password" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_id_key" ON "User" ("id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User" ("username");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Session_id_key" ON "Session" ("id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Session_user_id_idx" ON "Session" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Key_id_key" ON "Key" ("id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Key_user_id_idx" ON "Key" ("user_id");
*/