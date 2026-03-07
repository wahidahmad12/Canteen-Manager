import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const googleUrl = process.env.GOOGLE_DATABASE_URL;
const replitUrl = process.env.DATABASE_URL;

if (!googleUrl && !replitUrl) {
  throw new Error(
    "Database connection URL must be set. Configure GOOGLE_DATABASE_URL or DATABASE_URL.",
  );
}

export let pool: pg.Pool = null as any;
export let db: NodePgDatabase<typeof schema> = null as any;

async function initPool(): Promise<void> {
  if (googleUrl) {
    const gPool = new Pool({
      connectionString: googleUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    try {
      const client = await gPool.connect();
      client.release();
      console.log("[db] Connected to Google Cloud SQL");
      pool = gPool;
      db = drizzle(pool, { schema });
      return;
    } catch (err: any) {
      console.warn("[db] Google Cloud SQL unavailable:", err.message);
      await gPool.end().catch(() => {});
      if (replitUrl) {
        console.log("[db] Falling back to Replit database...");
      } else {
        throw err;
      }
    }
  }

  pool = new Pool({ connectionString: replitUrl! });
  const client = await pool.connect();
  client.release();
  console.log("[db] Connected to Replit database");
  db = drizzle(pool, { schema });
}

export const dbReady = initPool();
