-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE IF NOT EXISTS "migrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"migration" varchar(255) NOT NULL,
	"batch" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"nickname" varchar(255),
	"email" varchar(255) NOT NULL,
	"email_verified_at" timestamp(0),
	"password" varchar(255) NOT NULL,
	"github_id" varchar(255),
	"auth_type" varchar(255) NOT NULL,
	"remember_token" varchar(100),
	"created_at" timestamp(0),
	"updated_at" timestamp(0),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"email" varchar(255) PRIMARY KEY NOT NULL,
	"token" varchar(255) NOT NULL,
	"created_at" timestamp(0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "failed_jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"uuid" varchar(255) NOT NULL,
	"connection" text NOT NULL,
	"queue" text NOT NULL,
	"payload" text NOT NULL,
	"exception" text NOT NULL,
	"failed_at" timestamp(0) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "failed_jobs_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitor_user" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp(0),
	"updated_at" timestamp(0),
	"monitor_id" bigint NOT NULL,
	"user_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "personal_access_tokens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tokenable_type" varchar(255) NOT NULL,
	"tokenable_id" bigint NOT NULL,
	"name" varchar(255) NOT NULL,
	"token" varchar(64) NOT NULL,
	"abilities" text,
	"last_used_at" timestamp(0),
	"expires_at" timestamp(0),
	"created_at" timestamp(0),
	"updated_at" timestamp(0),
	CONSTRAINT "personal_access_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitors" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" varchar(255) NOT NULL,
	"login_name" varchar(255),
	"project_url" varchar(255),
	"organization_name" varchar(255),
	"pat_token" varchar(255),
	"readme" varchar(255),
	"public" boolean,
	"title" varchar(255),
	"short_description" varchar(255),
	"project_identification" integer NOT NULL,
	"monitor_hash" varchar(255) NOT NULL,
	"created_at" timestamp(0),
	"updated_at" timestamp(0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "milestones" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"url" varchar(255) NOT NULL,
	"state" varchar(255) NOT NULL,
	"description" varchar(255),
	"due_on" timestamp(0),
	"milestone_id" integer NOT NULL,
	"open_issues_count" integer,
	"closed_issues_count" integer,
	"progress" double precision NOT NULL,
	"repository_id" bigint NOT NULL,
	"created_at" timestamp(0),
	"updated_at" timestamp(0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"is_active" boolean,
	"body_url" varchar(255),
	"created_at" date,
	"updated_at" date,
	"last_edited_at" date,
	"closed_at" date,
	"body" varchar(255),
	"title" varchar(255),
	"url" varchar(255),
	"milestone_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assignees" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"avatar_url" varchar(255),
	"email" varchar(255),
	"login" varchar(255),
	"name" varchar(255),
	"pronouns" varchar(255),
	"url" varchar(255),
	"website_url" varchar(255),
	"task_id" bigint NOT NULL,
	"created_at" timestamp(0),
	"updated_at" timestamp(0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "labels" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"url" varchar(255),
	"name" varchar(255),
	"color" varchar(255),
	"created_at" date,
	"updated_at" date,
	"description" varchar(255),
	"is_default" boolean,
	"task_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "repositories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"monitor_id" bigint NOT NULL,
	"created_at" timestamp(0),
	"updated_at" timestamp(0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "personal_access_tokens_tokenable_type_tokenable_id_index" ON "personal_access_tokens" ("tokenable_type","tokenable_id");
*/