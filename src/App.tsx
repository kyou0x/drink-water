import { ChartColumn, House, SlidersHorizontal } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { HistoryView } from "./components/HistoryView";
import { SettingsView } from "./components/SettingsView";
import { TitleBar } from "./components/TitleBar";
import { TodayView } from "./components/TodayView";
import { aquaStore, useAqua } from "./state";

type Tab = "today" | "history" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("today");
  const status = useAqua((s) => s.status);
  const loadError = useAqua((s) => s.loadError);

  useEffect(() => {
    void aquaStore.getState().init();

    // Day rollover while the app stays open (also when it's shown from the tray).
    const check = () => void aquaStore.getState().checkDayRollover();
    const timer = setInterval(check, 15_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);

    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement;
      if (e.ctrlKey && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        void aquaStore.getState().undoLast();
      }
    };
    window.addEventListener("keydown", onKey);
    // No browser context menu / reload shortcuts in a desktop app.
    const noMenu = (e: MouseEvent) => {
      if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
    };
    window.addEventListener("contextmenu", noMenu);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("contextmenu", noMenu);
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <main className="min-h-0 flex-1">
        {status === "loading" && null}
        {status === "error" && (
          <div className="grid h-full place-items-center px-8 text-center text-sm text-muted">
            <div>
              <p className="font-medium text-fg">Não foi possível carregar seus dados.</p>
              <p className="mt-1 text-xs text-danger">{loadError}</p>
              <button
                type="button"
                onClick={() => void aquaStore.getState().init()}
                className="mt-4 rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-fg hover:bg-surface-3"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}
        {status === "ready" && (
          <>
            {tab === "today" && <TodayView />}
            {tab === "history" && <HistoryView />}
            {tab === "settings" && <SettingsView />}
          </>
        )}
      </main>
      <ToastHost />
      <nav className="flex h-14 shrink-0 border-t border-line px-2">
        <TabButton active={tab === "today"} onClick={() => setTab("today")} icon={<House />} label="Hoje" />
        <TabButton active={tab === "history"} onClick={() => setTab("history")} icon={<ChartColumn />} label="Histórico" />
        <TabButton active={tab === "settings"} onClick={() => setTab("settings")} icon={<SlidersHorizontal />} label="Ajustes" />
      </nav>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex flex-1 items-center justify-center gap-2 text-[13px] font-medium transition-colors [&>svg]:size-4 ${
        active ? "text-fg [&>svg]:text-accent" : "text-muted hover:text-fg"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ToastHost() {
  const toast = useAqua((s) => s.toast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => aquaStore.getState().dismissToast(), toast.kind === "error" ? 5000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role="status"
      className={`toast fixed bottom-[68px] left-1/2 z-10 flex max-w-[340px] -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2 text-xs whitespace-nowrap shadow-lg shadow-black/40 ${
        toast.kind === "error" ? "border-danger/30 bg-[#2a1719] text-danger" : "border-line bg-surface-3 text-fg"
      }`}
    >
      <span className="truncate">{toast.message}</span>
      {toast.undoId !== undefined && (
        <button
          type="button"
          onClick={() => void aquaStore.getState().undoLast()}
          className="font-semibold text-accent hover:brightness-125"
        >
          Desfazer
        </button>
      )}
    </div>
  );
}
