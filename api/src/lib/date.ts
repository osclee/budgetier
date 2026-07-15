/**
 * Pure date/window helpers for multi-month aggregation (Insights). Kept separate from
 * insights-compute.ts so the compute module stays focused on domain math, and so
 * "today" is always threaded in by the caller rather than computed internally —
 * that's what makes computeInsights unit-testable without mocking the clock.
 */

/** Today as "YYYY-MM-DD" (server local time). */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Shift a "YYYY-MM" by n months (n may be negative). */
export function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Inclusive [start, end] window of `months` calendar months ending at todayStr's month. */
export function computeWindow(todayStr: string, months: number): { start: string; end: string } {
  const end = todayStr.slice(0, 7);
  const start = shiftMonth(end, -(months - 1));
  return { start, end };
}

/** All "YYYY-MM" from start to end inclusive, chronological. Relies on lexical sortability. */
export function monthsInRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = shiftMonth(cur, 1);
  }
  return out;
}

/** Clamp a day-of-month (1-31) to a valid date within "YYYY-MM", e.g. day 31 in Feb -> 28/29. */
export function clampDayOfMonth(yearMonth: string, day: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const clamped = Math.min(Math.max(day, 1), daysInMonth);
  return `${yearMonth}-${String(clamped).padStart(2, "0")}`;
}

/** All "YYYY-MM-DD" from start to end inclusive, chronological. Returns [] if start > end. */
export function daysInRange(startDate: string, endDate: string): string[] {
  if (startDate > endDate) return [];
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const out: string[] = [];
  for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`
    );
  }
  return out;
}
