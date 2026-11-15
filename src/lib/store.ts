import { createStore } from "zustand/vanilla";
import { errorMessage, type AquaApi } from "./api";
import { addDays, dayKey } from "./date";
import { formatMl } from "./format";
import { lastEntry } from "./hydration";
import { DEFAULT_SETTINGS, type Entry, type Settings } from "./types";
import { validateAmount, validateSettings } from "./validation";

/** Days of daily totals kept in memory (history charts + streak). */
export const HISTORY_DAYS = 400;
/** Same amount re-submitted within this window is treated as an accidental double click. */
export const DUPLICATE_WINDOW_MS = 500;

export interface Toast {
  id: number;
  kind: "info" | "error";
  message: string;
  /** Entry that can be undone from the toast. */
  undoId?: number;
}

export interface AquaState {
  status: "loading" | "ready" | "error";
  loadError: string | null;
  settings: Settings;
  today: string;
  todayEntries: Entry[];
  /** day -> total ml */
  totals: Record<string, number>;
  pending: boolean;
  lastAdd: { amountMl: number; at: number } | null;
  toast: Toast | null;
  /** Increments every time today's total crosses the goal. */
  celebrate: number;
  /** Bumps whenever entries change, so views showing other days can reload. */
  revision: number;

  init(): Promise<void>;
  checkDayRollover(): Promise<boolean>;
  add(amountMl: number): Promise<boolean>;
  undoLast(): Promise<boolean>;
  updateEntry(entry: Entry, amountMl: number, time: string): Promise<boolean>;
  deleteEntry(entry: Entry): Promise<boolean>;
  saveSettings(settings: Settings): Promise<string | null>;
  listEntries(day: string): Promise<Entry[]>;
  showToast(toast: Omit<Toast, "id">): void;
  dismissToast(): void;
}

let toastSeq = 0;

export function createAquaStore(api: AquaApi, now: () => Date = () => new Date()) {
  return createStore<AquaState>()((set, get) => {
    const todayTotal = () => get().totals[get().today] ?? 0;

    const bumpTotal = (day: string, delta: number) =>
      set((s) => ({
        totals: { ...s.totals, [day]: Math.max(0, (s.totals[day] ?? 0) + delta) },
        revision: s.revision + 1,
      }));

    const fail = (err: unknown) => {
      get().showToast({ kind: "error", message: errorMessage(err) });
      return false as const;
    };

    async function loadAll(today: string) {
      const [settings, todayEntries, totals] = await Promise.all([
        api.getSettings(),
        api.listEntries(today),
        api.dailyTotals(addDays(today, -(HISTORY_DAYS - 1)), today),
      ]);
      const map: Record<string, number> = {};
      for (const t of totals) map[t.day] = t.totalMl;
      set((s) => ({
        settings,
        today,
        todayEntries,
        totals: map,
        status: "ready",
        loadError: null,
        revision: s.revision + 1,
      }));
    }

    async function removeEntry(entry: Entry): Promise<void> {
      await api.deleteEntry(entry.id);
      set((s) => ({ todayEntries: s.todayEntries.filter((e) => e.id !== entry.id) }));
      bumpTotal(entry.day, -entry.amountMl);
    }

    return {
      status: "loading",
      loadError: null,
      settings: DEFAULT_SETTINGS,
      today: dayKey(now()),
      todayEntries: [],
      totals: {},
      pending: false,
      lastAdd: null,
      toast: null,
      celebrate: 0,
      revision: 0,

      async init() {
        try {
          await loadAll(dayKey(now()));
        } catch (err) {
          set({ status: "error", loadError: errorMessage(err) });
        }
      },

      async checkDayRollover() {
        const current = dayKey(now());
        if (current === get().today) return false;
        // New local day: only the visual progress resets; history stays in the DB.
        set({ today: current, todayEntries: [], lastAdd: null });
        try {
          await loadAll(current);
        } catch (err) {
          fail(err);
        }
        return true;
      },

      async add(amountMl) {
        const valid = validateAmount(amountMl);
        if (!valid.ok) return fail(valid.error);
        const { pending, lastAdd } = get();
        const at = now().getTime();
        if (pending) return false;
        if (lastAdd && lastAdd.amountMl === amountMl && at - lastAdd.at < DUPLICATE_WINDOW_MS) return false;

        set({ pending: true, lastAdd: { amountMl, at } });
        try {
          await get().checkDayRollover();
          const before = todayTotal();
          const entry = await api.addEntry(valid.value);
          if (entry.day !== get().today) {
            await get().checkDayRollover();
          } else {
            set((s) => ({ todayEntries: [...s.todayEntries, entry] }));
            bumpTotal(entry.day, entry.amountMl);
          }
          const goal = get().settings.goalMl;
          if (before < goal && todayTotal() >= goal) set((s) => ({ celebrate: s.celebrate + 1 }));
          get().showToast({ kind: "info", message: `+${formatMl(entry.amountMl)} ml registrado`, undoId: entry.id });
          return true;
        } catch (err) {
          set({ lastAdd: null });
          return fail(err);
        } finally {
          set({ pending: false });
        }
      },

      async undoLast() {
        const last = lastEntry(get().todayEntries);
        if (!last || get().pending) return false;
        set({ pending: true });
        try {
          await removeEntry(last);
          set({ lastAdd: null });
          get().showToast({ kind: "info", message: `Registro de ${formatMl(last.amountMl)} ml desfeito` });
          return true;
        } catch (err) {
          return fail(err);
        } finally {
          set({ pending: false });
        }
      },

      async updateEntry(entry, amountMl, time) {
        const valid = validateAmount(amountMl);
        if (!valid.ok) return fail(valid.error);
        try {
          const updated = await api.updateEntry(entry.id, valid.value, time);
          set((s) => ({
            todayEntries: s.todayEntries.map((e) => (e.id === updated.id ? updated : e)),
          }));
          bumpTotal(entry.day, updated.amountMl - entry.amountMl);
          return true;
        } catch (err) {
          return fail(err);
        }
      },

      async deleteEntry(entry) {
        try {
          await removeEntry(entry);
          return true;
        } catch (err) {
          return fail(err);
        }
      },

      async saveSettings(settings) {
        const valid = validateSettings(settings);
        if (!valid.ok) return valid.error;
        try {
          const saved = await api.saveSettings(valid.value);
          set({ settings: saved });
          return null;
        } catch (err) {
          return errorMessage(err);
        }
      },

      listEntries: (day) => api.listEntries(day),

      showToast(toast) {
        set({ toast: { ...toast, id: ++toastSeq } });
      },

      dismissToast() {
        set({ toast: null });
      },
    };
  });
}

export type AquaStore = ReturnType<typeof createAquaStore>;
