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
    `CREATE TABLE IF NOT EXISTS employee_webauthn_credentials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NOT NULL,
      credential_id TEXT NOT NULL,
      public_key LONGTEXT NOT NULL,
      counter INT NOT NULL DEFAULT 0,
      device_type VARCHAR(50) DEFAULT '',
      transports TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS pec_ventures_rates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      month INT NOT NULL,
      year INT NOT NULL,
      red_label DECIMAL(10,3) DEFAULT '0',
      tata_tea DECIMAL(10,3) DEFAULT '0',
      coffee DECIMAL(10,3) DEFAULT '0',
      sugar DECIMAL(10,3) DEFAULT '0',
      ginger DECIMAL(10,3) DEFAULT '0',
      biscuit DECIMAL(10,3) DEFAULT '0',
      tea_cup DECIMAL(10,3) DEFAULT '0',
      green_elaychi DECIMAL(10,3) DEFAULT '0',
      green_tea DECIMAL(10,3) DEFAULT '0',
      black_salt DECIMAL(10,3) DEFAULT '0',
      milk DECIMAL(10,3) DEFAULT '0',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_pec_rate_month_year (month, year)
    )`,
  ];
  for (const sql of migrations) {
    try { await pool.execute(sql); } catch (e: any) { console.log('[db] migration note:', e.message?.slice(0, 80)); }
  }

  // Seed the default PEC Ventures rate row and lock (snapshot) every month that already has
  // saved entries, using the original hardcoded rates. This guarantees that previously-saved
  // months never change when an admin updates rates later. Idempotent: only fills missing rows.
  try {
    const [defRows]: any = await pool.query(`SELECT id FROM pec_ventures_rates WHERE month=0 AND year=0 LIMIT 1`);
    if (!defRows.length) {
      await pool.execute(
        `INSERT INTO pec_ventures_rates (month,year,red_label,tata_tea,coffee,sugar,ginger,biscuit,tea_cup,green_elaychi,green_tea,black_salt,milk)
         VALUES (0,0,620,310,5.5,48,180,5,0.8,3.6,120,115,28)`,
      );
    }
    const [defArr]: any = await pool.query(`SELECT * FROM pec_ventures_rates WHERE month=0 AND year=0 LIMIT 1`);
    const d = defArr[0];
    if (d) {
      const [missing]: any = await pool.query(
        `SELECT DISTINCT e.month AS month, e.year AS year
         FROM pec_ventures_entries e
         LEFT JOIN pec_ventures_rates r ON r.month = e.month AND r.year = e.year
         WHERE r.id IS NULL`,
      );
      for (const m of missing) {
        await pool.execute(
          `INSERT INTO pec_ventures_rates (month,year,red_label,tata_tea,coffee,sugar,ginger,biscuit,tea_cup,green_elaychi,green_tea,black_salt,milk)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [m.month, m.year, d.red_label, d.tata_tea, d.coffee, d.sugar, d.ginger, d.biscuit, d.tea_cup, d.green_elaychi, d.green_tea, d.black_salt, d.milk],
        );
      }
    }
  } catch (e: any) { console.log('[db] pec rates backfill note:', e.message?.slice(0, 120)); }
}

export const dbReady = initPool();
