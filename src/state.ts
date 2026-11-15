import { useStore } from "zustand";
import { tauriApi } from "./lib/api";
import { createAquaStore, type AquaState } from "./lib/store";

export const aquaStore = createAquaStore(tauriApi);

export function useAqua<T>(selector: (s: AquaState) => T): T {
  return useStore(aquaStore, selector);
}

export const useTodayTotal = () => useAqua((s) => s.totals[s.today] ?? 0);
