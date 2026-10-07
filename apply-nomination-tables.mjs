import { createRequire } from "module";
const require = createRequire(import.meta.url);
const mysql2 = require("mysql2/promise");

const conn = await mysql2.createConnection({
  uri: process.env.TIDB_DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

try {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS employee_nominations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NOT NULL,
      form_type VARCHAR(30) NOT NULL,
      date_of_submission DATE NOT NULL,
      place VARCHAR(100) DEFAULT 'Kolkata',
      eps_account_no VARCHAR(50) NULL,
      has_family VARCHAR(10) DEFAULT 'yes',
      parents_dependent VARCHAR(10) DEFAULT 'yes',
      religion VARCHAR(50) NULL,
      ticket_serial_no VARCHAR(50) NULL,
      date_of_appointment DATE NULL,
      date_of_superannuation DATE NULL,
      village VARCHAR(100) NULL,
      post_office VARCHAR(100) NULL,
      thana VARCHAR(100) NULL,
      district VARCHAR(100) NULL,
      state VARCHAR(100) NULL,
      pin_code VARCHAR(10) NULL,
      employer_name VARCHAR(150) DEFAULT 'DJ Hospitality & Facility Management Pvt Ltd',
      employer_designation VARCHAR(100) DEFAULT 'Authorized Signatory',
      employer_ref_no VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("✅ employee_nominations table ready");

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS nomination_nominees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nomination_id INT NOT NULL,
      nominee_category VARCHAR(20) DEFAULT 'GENERAL',
      name VARCHAR(150) NOT NULL,
      address TEXT NOT NULL,
      relationship VARCHAR(50) NOT NULL,
      date_of_birth DATE NULL,
      age INT NULL,
      share_percentage DECIMAL(5,2) NOT NULL,
      guardian_name VARCHAR(150) NULL,
      guardian_relationship VARCHAR(50) NULL,
      guardian_address TEXT NULL
    );
  `);
  console.log("✅ nomination_nominees table ready");
} catch (e) {
  console.error("Migration error:", e);
} finally {
  await conn.end();
}
