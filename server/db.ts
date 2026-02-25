
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const databaseUrl = process.env.GOOGLE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Database connection URL must be set. Configure GOOGLE_DATABASE_URL or DATABASE_URL.",
  );
}

const isGoogleCloud = !!process.env.GOOGLE_DATABASE_URL;
export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isGoogleCloud ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });
