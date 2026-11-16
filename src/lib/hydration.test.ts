import { beforeAll, describe, expect, it } from "vitest";
import { setLocale } from "../i18n";
import { addDays, dayKey, dayRange, parseDayKey } from "./date";
import { formatMl, formatPercent } from "./format";
import { computeProgress, goalStreak, lastEntry, summarizePeriod, sumEntries, totalsMap } from "./hydration";

beforeAll(() => setLocale("pt-BR"));

describe("computeProgress", () => {
  it("starts empty", () => {
    const p = computeProgress(0, 4500);
    expect(p).toMatchObject({ totalMl: 0, remainingMl: 4500, percent: 0, fill: 0, reached: false });
  });

  it("matches the spec examples (500 ml → 11,1%; +250 → 16,7%)", () => {
    const a = computeProgress(500, 4500);
    expect(formatPercent(a.percent)).toBe("11,1%");
    expect(a.remainingMl).toBe(4000);
    const b = computeProgress(750, 4500);
    expect(formatPercent(b.percent)).toBe("16,7%");
    expect(formatMl(b.totalMl)).toBe("750");
  });

  it("2.750 / 4.500 ml leaves 1.750 ml", () => {
    const p = computeProgress(2750, 4500);
    expect(formatMl(p.totalMl)).toBe("2.750");
    expect(formatMl(p.remainingMl)).toBe("1.750");
    expect(p.fill).toBeCloseTo(0.6111, 3);
  });

  it("fills completely exactly at the goal", () => {
    const p = computeProgress(4500, 4500);
    expect(p.fill).toBe(1);
    expect(p.reached).toBe(true);
    expect(p.remainingMl).toBe(0);
    expect(formatPercent(p.percent)).toBe("100%");
  });

  it("keeps counting beyond the goal while the bottle stays full", () => {
    const p = computeProgress(5200, 4500);
    expect(p.totalMl).toBe(5200);
    expect(p.fill).toBe(1);
    expect(p.surplusMl).toBe(700);
    expect(p.remainingMl).toBe(0);
    expect(p.percent).toBeGreaterThan(100);
  });

  it("never shows 100% before the goal is reached", () => {
    expect(formatPercent(computeProgress(4499, 4500).percent)).toBe("99,9%");
  });

  it("guards against negative or invalid totals", () => {
    expect(computeProgress(-300, 4500).totalMl).toBe(0);
    expect(computeProgress(100, 0).goalMl).toBe(1);
  });
});

describe("dates", () => {
  it("builds local day keys", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(dayKey(new Date(2026, 0, 6, 0, 0))).toBe("2026-01-06");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("builds ranges ending today", () => {
    expect(dayRange("2026-11-15", 3)).toEqual(["2026-11-13", "2026-11-14", "2026-11-15"]);
    expect(dayRange("2026-11-15", 30)).toHaveLength(30);
    expect(dayKey(parseDayKey("2026-11-15"))).toBe("2026-11-15");
  });
});

describe("history", () => {
  const goal = 4500;
  const totals = totalsMap([
    { day: "2026-11-10", totalMl: 4600 },
    { day: "2026-11-12", totalMl: 4500 },
    { day: "2026-11-13", totalMl: 5000 },
    { day: "2026-11-14", totalMl: 4700 },
    { day: "2026-11-15", totalMl: 1000 },
  ]);

  it("summarizes a 7-day window", () => {
    const s = summarizePeriod(totals, "2026-11-15", 7, goal);
    expect(s.series).toHaveLength(7);
    expect(s.series[0]?.day).toBe("2026-11-09");
    expect(s.daysMet).toBe(4);
    // tracked from first day with data (11-10) to today = 6 days
    expect(s.trackedDays).toBe(6);
    expect(s.totalMl).toBe(19800);
    expect(s.averageMl).toBe(3300);
  });

  it("returns zeros with no data", () => {
    const s = summarizePeriod(new Map(), "2026-11-15", 30, goal);
    expect(s.averageMl).toBe(0);
    expect(s.daysMet).toBe(0);
    expect(s.series).toHaveLength(30);
  });

  it("counts the streak from yesterday when today is still in progress", () => {
    expect(goalStreak(totals, "2026-11-15", goal)).toBe(3);
  });

  it("includes today once the goal is met", () => {
    const t = new Map(totals).set("2026-11-15", 4500);
    expect(goalStreak(t, "2026-11-15", goal)).toBe(4);
  });

  it("breaks the streak on a missed day", () => {
    const t = new Map(totals).set("2026-11-14", 100);
    expect(goalStreak(t, "2026-11-15", goal)).toBe(0);
  });

  it("finds the most recent entry and sums entries", () => {
    const entries = [
      { id: 1, amountMl: 250, ts: 1000, day: "d" },
      { id: 3, amountMl: 150, ts: 3000, day: "d" },
      { id: 2, amountMl: 500, ts: 3000, day: "d" },
    ];
    expect(lastEntry(entries)?.id).toBe(3);
    expect(lastEntry([])).toBeUndefined();
    expect(sumEntries(entries)).toBe(900);
  });
});
