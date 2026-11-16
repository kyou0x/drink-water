import type { LanguagePref } from "../i18n";

export interface Entry {
  id: number;
  amountMl: number;
  /** Unix epoch in milliseconds. */
  ts: number;
  /** Local calendar day the entry belongs to (YYYY-MM-DD). */
  day: string;
}

export interface DailyTotal {
  day: string;
  totalMl: number;
}

export type CloseBehavior = "tray" | "quit";

export interface Settings {
  goalMl: number;
  quickAmounts: number[];
  remindersEnabled: boolean;
  reminderIntervalMin: number;
  /** HH:MM, local time. */
  reminderStart: string;
  /** HH:MM, local time. */
  reminderEnd: string;
  autostart: boolean;
  closeBehavior: CloseBehavior;
  /** UI language, or "auto" to follow the system. */
  language: LanguagePref;
}

export const DEFAULT_SETTINGS: Settings = {
  goalMl: 4500,
  quickAmounts: [150, 250, 350, 500],
  remindersEnabled: false,
  reminderIntervalMin: 45,
  reminderStart: "08:00",
  reminderEnd: "22:00",
  autostart: false,
  closeBehavior: "tray",
  language: "auto",
};
