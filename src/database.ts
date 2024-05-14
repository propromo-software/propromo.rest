import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { DATABASE_MAIN_HOST, DATABASE_NEXT_HOST } from "./environment";
import * as schemaMainDB from "../main-drizzle/schema";
import * as schemaNextDB from "../next-drizzle/schema";

const mainClient = new Client({
	connectionString: DATABASE_MAIN_HOST,
});

const nextClient = new Client({
	connectionString: DATABASE_NEXT_HOST,
});

await mainClient.connect(); // .php stands for production or something idk
export const mdb = drizzle(mainClient, { schema: schemaMainDB });

await nextClient.connect(); // .ts stands for testing or something lol
export const ndb = drizzle(nextClient, { schema: schemaNextDB });
