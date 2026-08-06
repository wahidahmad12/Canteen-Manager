---
name: Grocery Scan tab restore
description: The dashboard Grocery Scan feature was removed once via rollback; it was restored without demo seed data.
---

The dashboard "Grocery Scan" tab (AI receipt scanner → `grocery_expenses` table) was added and then removed from main within 25 minutes on 2026-08-01 (likely a checkpoint rollback), while users kept referring to it as existing. It was restored on 2026-08-06 from the last pre-removal commit, **deliberately omitting the original demo seed INSERT** so restored installs don't get fake rows.

**Why:** re-running the seed would inject dummy grocery rows into real accounting exports.

**How to apply:** if a user references a feature that isn't in the code, check `git log --all --grep` before concluding it never existed — rollbacks here have silently deleted whole features. Never re-add demo seed data when restoring.
