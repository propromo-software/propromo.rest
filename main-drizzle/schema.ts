import {
	pgTable,
	serial,
	varchar,
	integer,
	unique,
	bigserial,
	timestamp,
	text,
	index,
	bigint,
	boolean,
	doublePrecision,
	date,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const migrations = pgTable("migrations", {
	id: serial("id").primaryKey().notNull(),
	migration: varchar("migration", { length: 255 }).notNull(),
	batch: integer("batch").notNull(),
});

export const users = pgTable(
	"users",
	{
		id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
		name: varchar("name", { length: 255 }).notNull(),
		nickname: varchar("nickname", { length: 255 }),
		email: varchar("email", { length: 255 }).notNull(),
		emailVerifiedAt: timestamp("email_verified_at", { mode: "string" }),
		password: varchar("password", { length: 255 }).notNull(),
		githubId: varchar("github_id", { length: 255 }),
		authType: varchar("auth_type", { length: 255 }).notNull(),
		rememberToken: varchar("remember_token", { length: 100 }),
		createdAt: timestamp("created_at", { mode: "string" }),
		updatedAt: timestamp("updated_at", { mode: "string" }),
	},
	(table) => {
		return {
			usersEmailUnique: unique("users_email_unique").on(table.email),
		};
	},
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
	email: varchar("email", { length: 255 }).primaryKey().notNull(),
	token: varchar("token", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: "string" }),
});

export const failedJobs = pgTable(
	"failed_jobs",
	{
		id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
		uuid: varchar("uuid", { length: 255 }).notNull(),
		connection: text("connection").notNull(),
		queue: text("queue").notNull(),
		payload: text("payload").notNull(),
		exception: text("exception").notNull(),
		failedAt: timestamp("failed_at", { mode: "string" }).defaultNow().notNull(),
	},
	(table) => {
		return {
			failedJobsUuidUnique: unique("failed_jobs_uuid_unique").on(table.uuid),
		};
	},
);

export const personalAccessTokens = pgTable(
	"personal_access_tokens",
	{
		id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
		tokenableType: varchar("tokenable_type", { length: 255 }).notNull(),
		// You can use { mode: "bigint" } if numbers are exceeding js number limitations
		tokenableId: bigint("tokenable_id", { mode: "number" }).notNull(),
		name: varchar("name", { length: 255 }).notNull(),
		token: varchar("token", { length: 64 }).notNull(),
		abilities: text("abilities"),
		lastUsedAt: timestamp("last_used_at", { mode: "string" }),
		expiresAt: timestamp("expires_at", { mode: "string" }),
		createdAt: timestamp("created_at", { mode: "string" }),
		updatedAt: timestamp("updated_at", { mode: "string" }),
	},
	(table) => {
		return {
			tokenableTypeTokenableIdIdx: index().on(
				table.tokenableType,
				table.tokenableId,
			),
			personalAccessTokensTokenUnique: unique(
				"personal_access_tokens_token_unique",
			).on(table.token),
		};
	},
);

export const monitors = pgTable("monitors", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	type: varchar("type", { length: 255 }).notNull(),
	loginName: varchar("login_name", { length: 255 }),
	projectUrl: varchar("project_url", { length: 255 }),
	organizationName: varchar("organization_name", { length: 255 }),
	patToken: text("pat_token"),
	readme: varchar("readme", { length: 255 }),
	public: boolean("public"),
	title: varchar("title", { length: 255 }),
	shortDescription: varchar("short_description", { length: 255 }),
	projectIdentification: integer("project_identification").notNull(),
	monitorHash: varchar("monitor_hash", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: "string" }),
	updatedAt: timestamp("updated_at", { mode: "string" }),
});

export const monitorUser = pgTable("monitor_user", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	createdAt: timestamp("created_at", { mode: "string" }),
	updatedAt: timestamp("updated_at", { mode: "string" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monitorId: bigint("monitor_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
});

export const milestones = pgTable("milestones", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	title: varchar("title", { length: 255 }).notNull(),
	url: varchar("url", { length: 255 }).notNull(),
	state: varchar("state", { length: 255 }).notNull(),
	description: varchar("description", { length: 255 }),
	dueOn: timestamp("due_on", { mode: "string" }),
	milestoneId: integer("milestone_id").notNull(),
	openIssuesCount: integer("open_issues_count"),
	closedIssuesCount: integer("closed_issues_count"),
	progress: doublePrecision("progress").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	repositoryId: bigint("repository_id", { mode: "number" }).notNull(),
	createdAt: timestamp("created_at", { mode: "string" }),
	updatedAt: timestamp("updated_at", { mode: "string" }),
});

export const tasks = pgTable("tasks", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	isActive: boolean("is_active"),
	bodyUrl: varchar("body_url", { length: 255 }),
	createdAt: date("created_at"),
	updatedAt: date("updated_at"),
	lastEditedAt: date("last_edited_at"),
	closedAt: date("closed_at"),
	body: varchar("body", { length: 255 }),
	title: varchar("title", { length: 255 }),
	url: varchar("url", { length: 255 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	milestoneId: bigint("milestone_id", { mode: "number" }).notNull(),
});

export const assignees = pgTable("assignees", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	avatarUrl: varchar("avatar_url", { length: 255 }),
	email: varchar("email", { length: 255 }),
	login: varchar("login", { length: 255 }),
	name: varchar("name", { length: 255 }),
	pronouns: varchar("pronouns", { length: 255 }),
	url: varchar("url", { length: 255 }),
	websiteUrl: varchar("website_url", { length: 255 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	taskId: bigint("task_id", { mode: "number" }).notNull(),
	createdAt: timestamp("created_at", { mode: "string" }),
	updatedAt: timestamp("updated_at", { mode: "string" }),
});

export const labels = pgTable("labels", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	url: varchar("url", { length: 255 }),
	name: varchar("name", { length: 255 }),
	color: varchar("color", { length: 255 }),
	createdAt: date("created_at"),
	updatedAt: date("updated_at"),
	description: varchar("description", { length: 255 }),
	isDefault: boolean("is_default"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	taskId: bigint("task_id", { mode: "number" }).notNull(),
});

export const repositories = pgTable("repositories", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monitorId: bigint("monitor_id", { mode: "number" }).notNull(),
	createdAt: timestamp("created_at", { mode: "string" }),
	updatedAt: timestamp("updated_at", { mode: "string" }),
});
