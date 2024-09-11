import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: "./next-schema.ts",
    out: "./next-drizzle",
    driver: "pg",
    dbCredentials: {
        connectionString: process.env.DATABASE_NEXT_HOST ?? "http://localhost:5432"
    },
    verbose: true
})
