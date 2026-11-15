import type { AquaApi } from "../lib/api";
import { dayKey } from "../lib/date";
import { DEFAULT_SETTINGS, type Entry, type Settings } from "../lib/types";

/** In-memory backend mirroring the Rust commands, driven by a controllable clock. */
export function createFakeApi(clock: { now: Date }) {
  let settings: Settings = { ...DEFAULT_SETTINGS };
  let entries: Entry[] = [];
  let seq = 0;
  const calls: string[] = [];

  const api: AquaApi = {
    async getSettings() {
      return { ...settings };
    },
    async saveSettings(s) {
      settings = { ...s };
      return { ...settings };
    },
    async addEntry(amountMl) {
      calls.push(`add:${amountMl}`);
      const ts = clock.now.getTime();
      const entry = { id: ++seq, amountMl, ts, day: dayKey(new Date(ts)) };
      entries.push(entry);
      return { ...entry };
    },
    async updateEntry(id, amountMl, time) {
      const e = entries.find((x) => x.id === id);
      if (!e) throw "Registro não encontrado.";
      const [h, m] = time.split(":").map(Number);
      const d = new Date(e.ts);
      d.setHours(h ?? 0, m ?? 0, 0, 0);
      e.amountMl = amountMl;
      e.ts = d.getTime();
      return { ...e };
    },
    async deleteEntry(id) {
      const before = entries.length;
      entries = entries.filter((e) => e.id !== id);
      if (entries.length === before) throw "Registro não encontrado.";
    },
    async listEntries(day) {
      return entries.filter((e) => e.day === day).map((e) => ({ ...e }));
    },
    async dailyTotals(from, to) {
      const map = new Map<string, number>();
      for (const e of entries) {
        if (e.day >= from && e.day <= to) map.set(e.day, (map.get(e.day) ?? 0) + e.amountMl);
      }
      return [...map].map(([day, totalMl]) => ({ day, totalMl }));
    },
  };

  return {
    api,
    calls,
    get entries() {
      return entries;
    },
    seed(e: Omit<Entry, "id">) {
      entries.push({ ...e, id: ++seq });
    },
  };
}
