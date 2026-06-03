---
name: DB schema changes (TiDB/MySQL)
description: How to add tables/columns in this repo — drizzle-kit push is unusable, use startup migrations.
---

# Applying schema changes

`npx drizzle-kit push` is interactive (prompts via raw TTY) and cannot be driven by piped input, so it is effectively unusable in this environment.

**The codebase applies all schema changes via an idempotent startup-migrations array in `server/db.ts`** (`initPool()`): a list of `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` strings run on every boot, each wrapped in try/catch that only logs on error.

**How to apply:** add new tables/columns to that array (and define them in `shared/schema.ts` for Drizzle types). Restart the workflow to run them. For data backfills, add plain `pool.query`/`pool.execute` JS after the loop — avoid `INSERT ... SELECT` that references the target table (MySQL error 1093); use a LEFT JOIN to find missing rows then insert each.

**Why:** keeps schema in sync without an interactive push step and without a separate migration tool.
