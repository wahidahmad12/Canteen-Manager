import { defineConfig } from "drizzle-kit";

const dbUrl = process.env.TIDB_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error("TIDB_DATABASE_URL or DATABASE_URL must be set");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "mysql",
  dbCredentials: {
    url: dbUrl + "?ssl={\"rejectUnauthorized\":true}",
  },
});
