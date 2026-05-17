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

  const migrations = [
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS face_descriptor LONGTEXT DEFAULT NULL`,
    `ALTER TABLE client_names ADD COLUMN IF NOT EXISTS attendance_lat DECIMAL(10,7) DEFAULT NULL`,
    `ALTER TABLE client_names ADD COLUMN IF NOT EXISTS attendance_lng DECIMAL(10,7) DEFAULT NULL`,
    `ALTER TABLE client_names ADD COLUMN IF NOT EXISTS attendance_radius INT DEFAULT 200`,
    `CREATE TABLE IF NOT EXISTS daily_attendance_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NOT NULL,
      client_name VARCHAR(500) NOT NULL,
      attendance_date DATE NOT NULL,
      status VARCHAR(10) NOT NULL DEFAULT 'P',
      scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      scanned_lat DECIMAL(10,7) DEFAULT NULL,
      scanned_lng DECIMAL(10,7) DEFAULT NULL,
      scanned_by VARCHAR(200) DEFAULT NULL,
      UNIQUE KEY uq_emp_date (employee_id, attendance_date),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`,
  ];
  for (const sql of migrations) {
    try { await pool.execute(sql); } catch (e: any) { console.log('[db] migration note:', e.message?.slice(0, 80)); }
  }
}

export const dbReady = initPool();
