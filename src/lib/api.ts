import { invoke } from "@tauri-apps/api/core";
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

export function errorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return "Erro inesperado.";
}
