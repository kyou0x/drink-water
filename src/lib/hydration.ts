import { addDays, dayRange } from "./date";
import type { DailyTotal, Entry } from "./types";

export interface Progress {
  totalMl: number;
  goalMl: number;
  remainingMl: number;
  /** Unbounded percentage of the goal (can exceed 100). */
  percent: number;
  /** Visual fill ratio for the bottle, clamped to [0, 1]. */
  fill: number;
  reached: boolean;
  surplusMl: number;
}

export function computeProgress(totalMl: number, goalMl: number): Progress {
  const total = Math.max(0, Math.round(totalMl));
  const goal = Math.max(1, Math.round(goalMl));
  const ratio = total / goal;
  return {
    totalMl: total,
    goalMl: goal,
    remainingMl: Math.max(0, goal - total),
    percent: ratio * 100,
    fill: Math.min(1, ratio),
    reached: total >= goal,
    surplusMl: Math.max(0, total - goal),
  };
}

export function sumEntries(entries: Entry[]): number {
  return entries.reduce((acc, e) => acc + e.amountMl, 0);
}

export function totalsMap(totals: DailyTotal[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of totals) map.set(t.day, (map.get(t.day) ?? 0) + t.totalMl);
  return map;
}

export interface PeriodSummary {
  series: DailyTotal[];
  totalMl: number;
  /** Average over tracked days in the period (from the first day with data up to today). */
  averageMl: number;
  trackedDays: number;
  daysMet: number;
}

export function summarizePeriod(
  totals: Map<string, number>,
  todayKey: string,
  days: number,
  goalMl: number,
): PeriodSummary {
  const keys = dayRange(todayKey, days);
  const series = keys.map((day) => ({ day, totalMl: totals.get(day) ?? 0 }));
  const firstIdx = series.findIndex((d) => d.totalMl > 0);
  const tracked = firstIdx === -1 ? [] : series.slice(firstIdx);
  const totalMl = tracked.reduce((a, d) => a + d.totalMl, 0);
  return {
    series,
    totalMl,
    averageMl: tracked.length ? Math.round(totalMl / tracked.length) : 0,
    trackedDays: tracked.length,
    daysMet: series.filter((d) => d.totalMl >= goalMl).length,
  };
}

/**
 * Consecutive days with the goal met, ending today. If today has not been met yet,
 * the streak is still alive and counts back from yesterday.
 */
export function goalStreak(totals: Map<string, number>, todayKey: string, goalMl: number): number {
  const met = (k: string) => (totals.get(k) ?? 0) >= goalMl;
  let cursor = met(todayKey) ? todayKey : addDays(todayKey, -1);
  let streak = 0;
  while (met(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Most recent entry (by timestamp, then id) — target for "undo". */
export function lastEntry(entries: Entry[]): Entry | undefined {
  let last: Entry | undefined;
  for (const e of entries) {
    if (!last || e.ts > last.ts || (e.ts === last.ts && e.id > last.id)) last = e;
  }
  return last;
}
