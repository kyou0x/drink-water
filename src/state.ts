import { useStore } from "zustand";
import { t } from "./i18n";
import { tauriApi } from "./lib/api";
import { createAquaStore, type AquaState } from "./lib/store";

export const aquaStore = createAquaStore(tauriApi);

export function useAqua<T>(selector: (s: AquaState) => T): T {
  return useStore(aquaStore, selector);
}

export const useTodayTotal = () => useAqua((s) => s.totals[s.today] ?? 0);

/** Messages of the active language; re-renders the component when it changes. */
export function useT() {
  useAqua((s) => s.locale);
  return t();
}
