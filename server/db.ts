import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "@shared/schema";

const tidbUrl = process.env.TIDB_DATABASE_URL;
const googleUrl = process.env.GOOGLE_DATABASE_URL;
const replitUrl = process.env.DATABASE_URL;

const connectionUrl = tidbUrl || googleUrl || replitUrl;

if (!connectionUrl) {
  throw new Error(
    "Database connection URL must be set. Configure TIDB_DATABASE_URL, GOOGLE_DATABASE_URL or DATABASE_URL.",
  );
}

export let pool: mysql.Pool = null as any;
export let db: ReturnType<typeof drizzle<typeof schema>> = null as any;

async function initPool(): Promise<void> {
  pool = mysql.createPool({
    uri: connectionUrl!,
    ssl: { rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
  });

  const conn = await pool.getConnection();
  conn.release();
  console.log("[db] Connected to TiDB Cloud");
  db = drizzle(pool, { schema, mode: "default" });
}

export const dbReady = initPool();
