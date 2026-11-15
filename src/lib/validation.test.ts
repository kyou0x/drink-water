import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./types";
import { isValidTime, parseAmount, validateAmount, validateGoal, validateSettings } from "./validation";

describe("parseAmount", () => {
  it.each([
    ["420", 420],
    [" 420 ", 420],
    ["420 ml", 420],
    ["420ML", 420],
    ["1.000", 1000],
    ["5000", 5000],
  ])("accepts %j", (input, expected) => {
    expect(parseAmount(input)).toEqual({ ok: true, value: expected });
  });

  it.each(["", "  ", "-250", "0", "abc", "12.5", "4,2", "1e3", "5001", "999999999", "NaN", "Infinity", "250; DROP"])(
    "rejects %j",
    (input) => {
      expect(parseAmount(input).ok).toBe(false);
    },
  );
});

describe("validateAmount", () => {
  it("rejects non-integers, negatives and non-finite values", () => {
    for (const v of [-1, 0, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 5001]) {
      expect(validateAmount(v).ok).toBe(false);
    }
    expect(validateAmount(1).ok).toBe(true);
  });
});

describe("settings", () => {
  it("accepts the defaults (4.500 ml goal)", () => {
    expect(DEFAULT_SETTINGS.goalMl).toBe(4500);
    expect(validateSettings(DEFAULT_SETTINGS).ok).toBe(true);
  });

  it("validates goal bounds", () => {
    expect(validateGoal(100).ok).toBe(false);
    expect(validateGoal(25000).ok).toBe(false);
    expect(validateGoal(3000).ok).toBe(true);
  });

  it("validates times and windows", () => {
    expect(isValidTime("08:00")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("8:00")).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, reminderStart: "22:00", reminderEnd: "22:00" }).ok).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, reminderStart: "22:00", reminderEnd: "06:00" }).ok).toBe(true);
  });

  it("validates quick amounts and intervals", () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, quickAmounts: [100, 200, 300] }).ok).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, quickAmounts: [100, 200, 300, -5] }).ok).toBe(false);
    expect(validateSettings({ ...DEFAULT_SETTINGS, reminderIntervalMin: 7 }).ok).toBe(false);
    for (const m of [30, 45, 60]) {
      expect(validateSettings({ ...DEFAULT_SETTINGS, reminderIntervalMin: m }).ok).toBe(true);
    }
  });
});
