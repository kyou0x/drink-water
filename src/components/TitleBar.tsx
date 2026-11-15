import { getCurrentWindow } from "@tauri-apps/api/window";
import { Droplet, Minus, Undo2, X } from "lucide-react";
import { formatLongDate } from "../lib/format";
import { parseDayKey } from "../lib/date";
import { aquaStore, useAqua } from "../state";

const win = () => getCurrentWindow();

export function TitleBar() {
  const today = useAqua((s) => s.today);
  const canUndo = useAqua((s) => s.todayEntries.length > 0);

  return (
    <header data-tauri-drag-region className="flex h-12 shrink-0 items-center gap-1 pr-2 pl-4">
      <div data-tauri-drag-region className="flex flex-1 items-center gap-1.5">
        <Droplet data-tauri-drag-region className="size-[18px] text-accent" strokeWidth={2.2} />
        <span data-tauri-drag-region className="text-[15px] font-semibold tracking-tight">
          aqua<span className="text-accent">.</span>
        </span>
      </div>

      <span data-tauri-drag-region title={formatLongDate(parseDayKey(today))} className="mr-1 text-xs text-muted">
        Hoje
      </span>
      <TitleButton
        label="Desfazer último registro (Ctrl+Z)"
        disabled={!canUndo}
        onClick={() => void aquaStore.getState().undoLast()}
      >
        <Undo2 className="size-[15px]" />
      </TitleButton>
      <TitleButton label="Minimizar" onClick={() => void win().minimize()}>
        <Minus className="size-[15px]" />
      </TitleButton>
      <TitleButton label="Fechar" danger onClick={() => void win().close()}>
        <X className="size-[15px]" />
      </TitleButton>
    </header>
  );
}

function TitleButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-7 place-items-center rounded-md text-muted transition-colors disabled:opacity-25 ${
        danger ? "hover:bg-danger/15 hover:text-danger" : "hover:bg-surface-2 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
