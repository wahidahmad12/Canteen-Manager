---
name: Upsert endpoints + authorization on natural keys
description: Why upsert (INSERT ... ON DUPLICATE KEY UPDATE) write-guards must validate against the natural key, not client-supplied body fields.
---

When a POST endpoint persists via `INSERT ... ON DUPLICATE KEY UPDATE` (upsert), the row
it touches is decided by the *natural/unique key* in the payload, not by other body fields.
Any authorization predicate must be derived from that same natural key.

**Why:** The date-entry tables (`pec_ventures_entries` keyed by `entry_date`;
`unichem_lunch_entries` keyed by `location,entry_date,meal_type`) upsert on those keys.
A first attempt at the "non-admin can't edit past months for PEC Ventures" rule checked
client-supplied `body.month`/`body.year`. A non-admin could send a *past* `entryDate` with
*forged current* `month`/`year`; the guard passed, then the upsert matched the past row by
`entryDate` and updated it — a clean authz bypass.

**How to apply:** For these POST upsert routes derive month/year from `entryDate`
(`monthYearFromEntryDate` in server/routes.ts) before the past-month check. PUT/DELETE are
safe because they look the row up by id and use the *stored* month/year. Never trust
non-key body fields for write authorization on an upsert.
