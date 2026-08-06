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
    `ALTER TABLE client_names ADD COLUMN IF NOT EXISTS client_code VARCHAR(100) DEFAULT ''`,
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
    `CREATE TABLE IF NOT EXISTS banana_rates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      effective_date VARCHAR(10) NOT NULL,
      rate DECIMAL(10,2) NOT NULL,
      UNIQUE KEY uq_banana_effective_date (effective_date)
    )`,
    `CREATE TABLE IF NOT EXISTS menu_category_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category_name VARCHAR(100) NOT NULL,
      item_name VARCHAR(200) NOT NULL,
      UNIQUE KEY uq_menu_cat_item (category_name, item_name)
    )`,
    `CREATE TABLE IF NOT EXISTS fixed_assets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      asset_tag VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      purchase_date VARCHAR(10) NOT NULL,
      vendor VARCHAR(255) DEFAULT '',
      category VARCHAR(100) DEFAULT '',
      location VARCHAR(200) DEFAULT '',
      cost DECIMAL(12,2) DEFAULT '0',
      depreciation_percent DECIMAL(5,2) DEFAULT '0',
      status VARCHAR(30) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_fixed_asset_tag (asset_tag)
    )`,
    `CREATE TABLE IF NOT EXISTS fixed_asset_options (
      id INT AUTO_INCREMENT PRIMARY KEY,
      option_type VARCHAR(20) NOT NULL,
      name VARCHAR(200) NOT NULL,
      UNIQUE KEY uq_fa_option (option_type, name)
    )`,
    `INSERT IGNORE INTO fixed_asset_options (option_type, name) VALUES
      ('category','Kitchen Equipment'),('category','Refrigeration'),('category','Dining Furniture'),('category','POS & Electronics'),('category','Other'),
      ('location','Main Kitchen'),('location','Dining Hall A'),('location','Dining Hall B'),('location','Cold Storage Unit'),('location','Counter POS')`,
    `CREATE TABLE IF NOT EXISTS payment_outs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vendor_name VARCHAR(200) NOT NULL,
      payment_date DATE NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      utr_no VARCHAR(100) DEFAULT '',
      allocated_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      created_by VARCHAR(200) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE purchase_invoice_payments ADD COLUMN IF NOT EXISTS payment_out_id INT NULL`,
    `ALTER TABLE payment_outs ADD COLUMN IF NOT EXISTS client_name VARCHAR(200) DEFAULT ''`,
    `CREATE TABLE IF NOT EXISTS tax_invoices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_number VARCHAR(50) NOT NULL,
      invoice_date VARCHAR(10) NOT NULL,
      po_number VARCHAR(100) DEFAULT '',
      po_date VARCHAR(10) DEFAULT '',
      vendor_code VARCHAR(50) DEFAULT '',
      bill_to_name VARCHAR(255) NOT NULL,
      bill_to_address TEXT,
      place_of_supply VARCHAR(100) DEFAULT '',
      bill_to_gstin VARCHAR(30) DEFAULT '',
      ship_to_name VARCHAR(255) DEFAULT '',
      ship_to_address TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS tax_invoice_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      description TEXT,
      hsn VARCHAR(20) DEFAULT '',
      quantity DECIMAL(12,2) DEFAULT '0',
      uom VARCHAR(30) DEFAULT '',
      rate DECIMAL(12,2) DEFAULT '0',
      igst_percent DECIMAL(5,2) DEFAULT '0',
      FOREIGN KEY (invoice_id) REFERENCES tax_invoices(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS quotations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      quotation_no VARCHAR(100) DEFAULT '',
      quotation_date VARCHAR(10) NOT NULL,
      quotation_thru VARCHAR(200) DEFAULT '',
      client_name VARCHAR(500) DEFAULT '',
      total_amount DECIMAL(14,2) DEFAULT '0',
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      remarks TEXT,
      created_by VARCHAR(200) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS quotation_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      quotation_id INT NOT NULL,
      item_name VARCHAR(500) DEFAULT '',
      qty DECIMAL(12,2) DEFAULT '0',
      rate DECIMAL(12,2) DEFAULT '0',
      amount DECIMAL(14,2) DEFAULT '0',
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
    )`,
    `UPDATE quotations SET quotation_no = CONCAT('DJ-GEN-00-Q', LPAD(id, 3, '0')) WHERE quotation_no = ''`,
    `ALTER TABLE quotations ADD COLUMN IF NOT EXISTS po_number VARCHAR(100) DEFAULT ''`,
    `ALTER TABLE quotations ADD COLUMN IF NOT EXISTS po_date VARCHAR(10) DEFAULT ''`,
    `ALTER TABLE quotations ADD COLUMN IF NOT EXISTS po_id INT NULL`,
    `ALTER TABLE quotations ADD UNIQUE INDEX uq_quotation_no (quotation_no)`,
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

  // Seed the Banana expense rate schedule: ₹4.50 historically, ₹5.00 from 1 July 2026.
  // Idempotent: only seeds when the table is empty so admin edits are never overwritten.
  try {
    const [rows]: any = await pool.query(`SELECT COUNT(*) AS c FROM banana_rates`);
    if (!rows[0] || Number(rows[0].c) === 0) {
      await pool.execute(
        `INSERT INTO banana_rates (effective_date, rate) VALUES ('2000-01-01', 4.50), ('2026-07-01', 5.00)`,
      );
    }
  } catch (e: any) { console.log('[db] banana rates seed note:', e.message?.slice(0, 120)); }
}

export const dbReady = initPool();
