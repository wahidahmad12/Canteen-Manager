import { createRequire } from "module";
const require = createRequire(import.meta.url);
const mysql2 = require("mysql2/promise");

const conn = await mysql2.createConnection({
  uri: process.env.TIDB_DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

try {
  await conn.execute(`ALTER TABLE bom_items ADD COLUMN manual_rate DECIMAL(12,4) NULL DEFAULT NULL`);
  console.log("✅ manual_rate column added to bom_items");
} catch(e) {
  if (e.message && e.message.includes("Duplicate column")) {
    console.log("ℹ️ Column already exists");
  } else {
    throw e;
  }
}
await conn.end();
