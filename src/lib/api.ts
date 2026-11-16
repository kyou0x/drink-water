import { invoke } from "@tauri-apps/api/core";
import { t, type Messages } from "../i18n";
import type { DailyTotal, Entry, Settings } from "./types";

export interface AquaApi {
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<Settings>;
  addEntry(amountMl: number): Promise<Entry>;
  /** `time` is HH:MM (local). The entry keeps its original day. */
  updateEntry(id: number, amountMl: number, time: string): Promise<Entry>;
  deleteEntry(id: number): Promise<void>;
  listEntries(day: string): Promise<Entry[]>;
  dailyTotals(fromDay: string, toDay: string): Promise<DailyTotal[]>;
}

export const tauriApi: AquaApi = {
  getSettings: () => invoke("get_settings"),
  saveSettings: (settings) => invoke("save_settings", { settings }),
  addEntry: (amountMl) => invoke("add_entry", { amountMl }),
  updateEntry: (id, amountMl, time) => invoke("update_entry", { id, amountMl, time }),
  deleteEntry: (id) => invoke("delete_entry", { id }),
  listEntries: (day) => invoke("list_entries", { day }),
  dailyTotals: (fromDay, toDay) => invoke("daily_totals", { fromDay, toDay }),
};

/** Stable error codes returned by the Rust commands (see `src-tauri/src/model.rs`). */
const BACKEND_ERRORS: Record<string, keyof Messages["errors"]> = {
  amount_too_small: "amountPositive",
  amount_too_large: "invalidAmount",
  invalid_time: "invalidTime",
  invalid_date: "unexpected",
  invalid_goal: "invalidAmount",
  invalid_quick_amounts: "quickCount",
  invalid_interval: "invalidInterval",
  same_reminder_times: "sameTimes",
  invalid_language: "invalidLanguage",
  entry_not_found: "entryNotFound",
  nonexistent_time: "nonexistentTime",
  future_time: "futureTime",
  db_unavailable: "dbUnavailable",
  autostart_failed: "autostartFailed",
};

export function errorMessage(err: unknown): string {
  const e = t().errors;
  if (typeof err === "string") {
    // Codes may carry details after a colon, e.g. "autostart_failed: access denied".
    const key = BACKEND_ERRORS[err.split(":")[0] ?? ""];
    if (key) {
      const msg = e[key];
      return typeof msg === "string" ? msg : e.unexpected;
    }
    return err;
  }
  if (err instanceof Error) return err.message;
  return e.unexpected;
}
