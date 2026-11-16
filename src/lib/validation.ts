import { isLanguagePref, t } from "../i18n";
import { formatMl } from "./format";
import type { Settings } from "./types";

export const MIN_ENTRY_ML = 1;
export const MAX_ENTRY_ML = 5000;
export const MIN_GOAL_ML = 250;
export const MAX_GOAL_ML = 20000;
export const REMINDER_INTERVALS = [30, 45, 60, 90, 120] as const;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Parses user-typed amounts such as "420", " 420 ml", "1.000", "1,000" or "1 000".
 * Only whole millilitres are accepted, so "." and "," are always thousands separators.
 */
export function parseAmount(input: string): Result<number> {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/\s*(ml|мл)$/, "")
    .replace(/\s+/g, "");
  if (cleaned === "") return { ok: false, error: t().errors.enterAmount };
  if (!/^\d{1,3}([.,']\d{3})+$|^\d+$/.test(cleaned)) {
    return { ok: false, error: t().errors.integersOnly };
  }
  return validateAmount(Number(cleaned.replace(/[.,']/g, "")));
}

export function validateAmount(value: number): Result<number> {
  const e = t().errors;
  if (!Number.isFinite(value) || !Number.isInteger(value)) return { ok: false, error: e.invalidAmount };
  if (value < MIN_ENTRY_ML) return { ok: false, error: e.amountPositive };
  if (value > MAX_ENTRY_ML) return { ok: false, error: e.amountMax(formatMl(MAX_ENTRY_ML)) };
  return { ok: true, value };
}

export function validateGoal(value: number): Result<number> {
  if (!Number.isInteger(value) || value < MIN_GOAL_ML || value > MAX_GOAL_ML) {
    return { ok: false, error: t().errors.goalRange(formatMl(MIN_GOAL_ML), formatMl(MAX_GOAL_ML)) };
  }
  return { ok: true, value };
}

export function isValidTime(value: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return false;
  return Number(m[1]) < 24 && Number(m[2]) < 60;
}

export function validateSettings(s: Settings): Result<Settings> {
  const e = t().errors;
  const goal = validateGoal(s.goalMl);
  if (!goal.ok) return goal;
  if (s.quickAmounts.length !== 4) return { ok: false, error: e.quickCount };
  for (const q of s.quickAmounts) {
    const r = validateAmount(q);
    if (!r.ok) return { ok: false, error: e.quickPrefix(r.error) };
  }
  if (!(REMINDER_INTERVALS as readonly number[]).includes(s.reminderIntervalMin)) {
    return { ok: false, error: e.invalidInterval };
  }
  if (!isValidTime(s.reminderStart) || !isValidTime(s.reminderEnd)) return { ok: false, error: e.invalidTime };
  if (s.reminderStart === s.reminderEnd) return { ok: false, error: e.sameTimes };
  if (s.closeBehavior !== "tray" && s.closeBehavior !== "quit") return { ok: false, error: e.invalidClose };
  if (!isLanguagePref(s.language)) return { ok: false, error: e.invalidLanguage };
  return { ok: true, value: s };
}
