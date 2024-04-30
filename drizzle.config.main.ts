import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: "./main-schema.ts",
    out: "./main-drizzle",
    driver: "pg",
    dbCredentials: {
        connectionString: process.env.DATABASE_MAIN_HOST!
    },
    verbose: true
})
