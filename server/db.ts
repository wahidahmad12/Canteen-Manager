import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "@shared/schema";

const tidbUrl = process.env.TIDB_DATABASE_URL;

if (!tidbUrl) {
  throw new Error(
    "[db] CRITICAL: TIDB_DATABASE_URL is not set. " +
    "The app will NOT fall back to any other database to prevent accidental data loss. " +
    "Set TIDB_DATABASE_URL in Replit Secrets (shared environment) and restart.",
  );
}

export let pool: mysql.Pool = null as any;
export let db: ReturnType<typeof drizzle<typeof schema>> = null as any;

async function initPool(): Promise<void> {
  pool = mysql.createPool({
    uri: tidbUrl!,
    ssl: { rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
  });

  const conn = await pool.getConnection();
  conn.release();
  const host = tidbUrl!.split("@")[1]?.split("/")[0] ?? "unknown";
  console.log(`[db] Connected to TiDB Cloud (${host})`);
  db = drizzle(pool, { schema, mode: "default" });
}

export const dbReady = initPool();
