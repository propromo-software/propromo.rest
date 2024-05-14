import { pgTable, uniqueIndex, text, index, bigint } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const user = pgTable(
	"User",
	{
		id: text("id").primaryKey().notNull(),
		username: text("username").notNull(),
	},
	(table) => {
		return {
			idKey: uniqueIndex("User_id_key").on(table.id),
			usernameKey: uniqueIndex("User_username_key").on(table.username),
		};
	},
);

export const session = pgTable(
	"Session",
	{
		id: text("id").primaryKey().notNull(),
		userId: text("user_id").notNull(),
		// You can use { mode: "bigint" } if numbers are exceeding js number limitations
		activeExpires: bigint("active_expires", { mode: "number" }).notNull(),
		// You can use { mode: "bigint" } if numbers are exceeding js number limitations
		idleExpires: bigint("idle_expires", { mode: "number" }).notNull(),
	},
	(table) => {
		return {
			idKey: uniqueIndex("Session_id_key").on(table.id),
			userIdIdx: index("Session_user_id_idx").on(table.userId),
		};
	},
);

export const key = pgTable(
	"Key",
	{
		id: text("id").primaryKey().notNull(),
		hashedPassword: text("hashed_password"),
		userId: text("user_id").notNull(),
	},
	(table) => {
		return {
			idKey: uniqueIndex("Key_id_key").on(table.id),
			userIdIdx: index("Key_user_id_idx").on(table.userId),
		};
	},
);
