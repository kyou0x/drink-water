import { CircleCheck, CirclePlus } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { formatMl, formatPercent } from "../lib/format";
import { computeProgress } from "../lib/hydration";
import { useTween } from "../lib/useTween";
import { parseAmount } from "../lib/validation";
import { aquaStore, useAqua, useT, useTodayTotal } from "../state";
import { Bottle } from "./Bottle";

export function TodayView() {
  const total = useTodayTotal();
  const goal = useAqua((s) => s.settings.goalMl);
  const quick = useAqua((s) => s.settings.quickAmounts);
  const pending = useAqua((s) => s.pending);
  const celebrate = useAqua((s) => s.celebrate);
  const m = useT();
  const p = computeProgress(total, goal);
  const shown = useTween(p.totalMl);

  return (
    <div className="view flex h-full flex-col px-5 pb-4">
      <div className="flex min-h-0 flex-1 justify-center py-2">
        <Bottle fill={p.fill} goalMl={p.goalMl} celebrate={celebrate} label={m.today.bottleAria(Math.round(p.fill * 100))} />
      </div>

      <div className="mt-2 text-center" aria-live="polite">
        <div className="tabular-nums">
          <span className="text-[30px] leading-none font-semibold tracking-tight">{formatMl(shown)}</span>
          <span className="ml-1.5 text-[15px] font-medium text-muted">/ {formatMl(p.goalMl)} {m.ml}</span>
        </div>
        <div className="mt-2 text-sm font-medium text-accent tabular-nums">
          {m.today.ofGoal(formatPercent(p.percent))}
        </div>
        <div className="mt-1 flex h-4 items-center justify-center gap-1 text-xs text-muted tabular-nums">
          {p.reached ? (
            <>
              <CircleCheck className="size-3.5 text-accent" />
              {m.today.goalReached}
              {p.surplusMl > 0 && ` · +${formatMl(p.surplusMl)} ${m.ml}`}
            </>
          ) : (
            <>{m.today.remaining(formatMl(p.remainingMl))}</>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {quick.map((ml, i) => (
          <button
            key={i}
            type="button"
            disabled={pending}
            onClick={() => void aquaStore.getState().add(ml)}
            className="h-11 rounded-xl border border-line bg-surface text-[13px] font-semibold tabular-nums transition-all duration-150 hover:border-accent/25 hover:bg-surface-2 active:scale-[0.96] disabled:opacity-60"
          >
            +{formatMl(ml)} {m.ml}
          </button>
        ))}
      </div>

      <CustomAmount disabled={pending} />
    </div>
  );
}

function CustomAmount({ disabled }: { disabled: boolean }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const m = useT();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = parseAmount(value);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (await aquaStore.getState().add(parsed.value)) {
      setValue("");
      setError(null);
      inputRef.current?.blur();
    }
  }

  return (
    <form onSubmit={submit} className="mt-2.5">
      <div
        className={`flex h-12 items-center rounded-xl border bg-surface pr-1.5 pl-4 transition-colors focus-within:border-accent/40 ${
          error ? "border-danger/50" : "border-line"
        }`}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          inputMode="numeric"
          maxLength={8}
          placeholder={m.today.customPlaceholder}
          aria-label={m.today.customAria}
          className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none placeholder:text-muted"
        />
        {value && <span className="mr-2 text-xs text-subtle">{m.ml}</span>}
        <button
          type="submit"
          disabled={disabled}
          title={m.today.add}
          aria-label={m.today.addAria}
          className="grid size-9 place-items-center rounded-lg text-accent transition-colors hover:bg-surface-3 disabled:opacity-50"
        >
          <CirclePlus className="size-5" />
        </button>
      </div>
      <p className="mt-1 h-4 pl-1 text-[11px] text-danger">{error}</p>
    </form>
  );
}
