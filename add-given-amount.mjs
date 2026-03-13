import { createRequire } from "module";
const require = createRequire(import.meta.url);
const mysql2 = require("mysql2/promise");

const conn = await mysql2.createConnection({
  uri: process.env.TIDB_DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

try {
  await conn.execute(`ALTER TABLE pankaj_reports ADD COLUMN given_amount DECIMAL(12,2) NULL`);
  console.log("✅ given_amount column added");
} catch(e) {
  if (e.message.includes("Duplicate column")) {
    console.log("ℹ️ Column already exists");
  } else {
    throw e;
  }
}
await conn.end();
