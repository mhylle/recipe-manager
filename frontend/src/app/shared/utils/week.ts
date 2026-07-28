/**
 * The Monday on or before `date`, as YYYY-MM-DD.
 *
 * Formatted from LOCAL date parts rather than `toISOString()`. That matters:
 * `toISOString()` converts to UTC, and Denmark runs at UTC+2 in summer, so any
 * local time before 02:00 lands on the PREVIOUS day — the app would then read
 * and write the wrong week's meal plan. Rare enough to be baffling when it hit.
 */
export function mondayOf(date: Date = new Date()): string {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0 = Sunday
  const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - daysBack);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
