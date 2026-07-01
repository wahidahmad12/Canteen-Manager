// Date-effective Banana expense rate.
// The Banana price changed over time (₹4.50 historically, ₹5.00 from 1 July 2026),
// and admins can add more future rate changes. Each Cash Seal is priced using the
// rate that was in effect on that seal's date. This helper is shared by the client
// (live totals, PDFs, dashboards) and the server (P&L aggregation) so the logic
// stays identical everywhere.

export const DEFAULT_BANANA_RATE = 4.5;

export interface BananaRatePeriod {
  effectiveDate: string; // YYYY-MM-DD, the first date this rate applies from
  rate: number | string;
}

function toYMD(date: string | Date | null | undefined): string {
  if (!date) return "";
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(date).slice(0, 10);
}

// Returns the Banana rate that applies on the given date, based on the schedule.
// Picks the latest period whose effectiveDate is on or before the date.
export function bananaRateForDate(
  date: string | Date | null | undefined,
  schedule: BananaRatePeriod[] | undefined | null,
): number {
  const ymd = toYMD(date);
  let rate = DEFAULT_BANANA_RATE;
  if (!schedule || schedule.length === 0 || !ymd) return rate;
  const sorted = [...schedule]
    .filter((p) => p && /^\d{4}-\d{2}-\d{2}$/.test(p.effectiveDate))
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  for (const p of sorted) {
    if (p.effectiveDate <= ymd) {
      const r = Number(p.rate);
      if (Number.isFinite(r)) rate = r;
    } else {
      break;
    }
  }
  return rate;
}

// Builds a SQL CASE expression (as a string) that maps a date column to its Banana
// rate, for use inside aggregate P&L queries. effectiveDate is validated against a
// strict YYYY-MM-DD pattern and rate is coerced to a number, so the output is safe
// to embed. `dateExpr` must be a trusted SQL identifier (e.g. "dr.date").
export function bananaRateSqlCase(
  dateExpr: string,
  schedule: BananaRatePeriod[] | undefined | null,
): string {
  const valid = (schedule || [])
    .filter(
      (p) =>
        p &&
        /^\d{4}-\d{2}-\d{2}$/.test(p.effectiveDate) &&
        Number.isFinite(Number(p.rate)),
    )
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)); // newest first
  if (valid.length === 0) return String(DEFAULT_BANANA_RATE);
  const whens = valid
    .map((p) => `WHEN ${dateExpr} >= '${p.effectiveDate}' THEN ${Number(p.rate)}`)
    .join(" ");
  return `(CASE ${whens} ELSE ${DEFAULT_BANANA_RATE} END)`;
}
