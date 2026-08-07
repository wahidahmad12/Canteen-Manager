---
name: Skill category matching in payroll
description: Employee skills vs skill_wage_rates matching pitfalls (typos, trailing spaces, MySQL vs JS comparison)
---

Salary generation picks the monthly basic rate by exact-matching `employees.skills` against `skill_wage_rates.skill_category`, falling back silently to `employees.daily_rate` on no match.

**Why:** Legacy employee data contained typos ("Sami Skilled", "UnSkile") and trailing spaces ("Unskilled "). MySQL non-binary collation ignores trailing spaces in `=` comparisons, but JS Map lookups on the client do NOT — so server and UI can disagree. A typo silently freezes an employee at the old flat rate.

**How to apply:** Skills are now normalized in the DB (trimmed, canonical categories: Unskilled, Semi Skilled, Skilled, High Skilled, Partner) and code trims before matching (server storage/routes + salary page). If a "rate not updated for employee X" complaint comes in, first check `TRIM(skills)` vs skill_wage_rates categories, then whether the month's salary_records were generated before the fix (regenerate via storage.generateSalary — safe if paid_on is null; it overwrites manual edits).
