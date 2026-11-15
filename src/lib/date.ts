/** Local calendar day key (YYYY-MM-DD) using the system time zone. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses a day key into a local Date at noon (noon avoids DST edge cases). */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function addDays(key: string, n: number): string {
  const date = parseDayKey(key);
  date.setDate(date.getDate() + n);
  return dayKey(date);
}

/** `count` consecutive day keys ending at (and including) `endKey`, oldest first. */
export function dayRange(endKey: string, count: number): string[] {
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) days.push(addDays(endKey, -i));
  return days;
}

/** Whole days between two keys (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDayKey(b).getTime() - parseDayKey(a).getTime()) / 86_400_000);
}

export function timeOfDay(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
