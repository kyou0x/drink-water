import { CalendarCheck, Check, Droplet, Flame, Pencil, Trash2, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { parseDayKey, timeOfDay } from "../lib/date";
import { formatLongDate, formatMl, formatShortDate, formatWeekday } from "../lib/format";
import { goalStreak, summarizePeriod } from "../lib/hydration";
import type { DailyTotal, Entry } from "../lib/types";
import { isValidTime, parseAmount } from "../lib/validation";
import { aquaStore, useAqua, useT } from "../state";
import { inputClass, Segmented } from "./ui";

export function HistoryView() {
  const today = useAqua((s) => s.today);
  const totals = useAqua((s) => s.totals);
  const goal = useAqua((s) => s.settings.goalMl);
  const m = useT();
  const [range, setRange] = useState<7 | 30>(7);
  const [selected, setSelected] = useState(today);

  // Follow the day rollover if the user was looking at "today".
  const [prevToday, setPrevToday] = useState(today);
  if (prevToday !== today) {
    setPrevToday(today);
    if (selected === prevToday) setSelected(today);
  }

  const map = useMemo(() => new Map(Object.entries(totals)), [totals]);
  const summary = useMemo(() => summarizePeriod(map, today, range, goal), [map, today, range, goal]);
  const streak = useMemo(() => goalStreak(map, today, goal), [map, today, goal]);

  return (
    <div className="view h-full space-y-4 overflow-y-auto px-5 pt-1 pb-5">
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: 7, label: m.history.days7 },
          { value: 30, label: m.history.days30 },
        ]}
      />

      <div className="grid grid-cols-2 gap-2">
        <Stat icon={<Droplet />} label={m.history.today} value={`${formatMl(map.get(today) ?? 0)} ${m.ml}`} />
        <Stat icon={<TrendingUp />} label={m.history.average} value={`${formatMl(summary.averageMl)} ${m.ml}`} />
        <Stat icon={<CalendarCheck />} label={m.history.goalMet} value={m.history.goalMetValue(summary.daysMet, range)} />
        <Stat icon={<Flame />} label={m.history.streak} value={m.history.streakValue(streak)} />
      </div>

      <Chart series={summary.series} goal={goal} selected={selected} today={today} onSelect={setSelected} />

      <DayEntries day={selected} today={today} />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted [&>svg]:size-3.5 [&>svg]:text-accent/80">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-[15px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Chart({
  series,
  goal,
  selected,
  today,
  onSelect,
}: {
  series: DailyTotal[];
  goal: number;
  selected: string;
  today: string;
  onSelect: (day: string) => void;
}) {
  const W = 340;
  const H = 110;
  const max = Math.max(goal * 1.15, ...series.map((d) => d.totalMl));
  const slot = W / series.length;
  const barW = Math.max(3, Math.min(26, slot * 0.62));
  const y = (v: number) => H - (v / max) * H;
  const dense = series.length > 7;
  const m = useT();

  return (
    <div className="rounded-xl border border-line bg-surface px-3 pt-3 pb-2">
      <svg viewBox={`0 -4 ${W} ${H + 22}`} className="w-full" role="img" aria-label={m.history.chartAria}>
        <line x1={0} x2={W} y1={y(goal)} y2={y(goal)} stroke="#5ab0ea" strokeOpacity="0.35" strokeDasharray="3 4" />
        <text x={0} y={y(goal) - 4} fontSize="9" fill="#5ab0ea" fillOpacity="0.7">
          {m.history.chartGoal}
        </text>
        {series.map((d, i) => {
          const x = i * slot + (slot - barW) / 2;
          const h = Math.max(d.totalMl > 0 ? 3 : 1.5, H - y(d.totalMl));
          const met = d.totalMl >= goal;
          const isSel = d.day === selected;
          const date = parseDayKey(d.day);
          const showLabel = !dense || i % 5 === (series.length - 1) % 5;
          return (
            <g key={d.day} onClick={() => onSelect(d.day)} className="cursor-pointer">
              <title>{`${formatShortDate(date)}: ${formatMl(d.totalMl)} ${m.ml}`}</title>
              <rect x={i * slot} y={-4} width={slot} height={H + 22} fill="transparent" />
              <rect
                x={x}
                y={H - h}
                width={barW}
                height={h}
                rx={Math.min(4, barW / 2)}
                fill={met ? "#5ab0ea" : "#2c3846"}
                fillOpacity={isSel ? 1 : met ? 0.75 : 0.9}
                stroke={isSel ? "#cfe6f8" : "none"}
                strokeWidth={isSel ? 1.2 : 0}
                style={{ transition: "y 400ms, height 400ms" }}
              />
              {showLabel && (
                <text
                  x={i * slot + slot / 2}
                  y={H + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fill={d.day === today ? "#e8eef4" : "#5c6878"}
                >
                  {dense ? date.getDate() : formatWeekday(date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DayEntries({ day, today }: { day: string; today: string }) {
  const revision = useAqua((s) => s.revision);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const m = useT();

  useEffect(() => {
    let alive = true;
    aquaStore
      .getState()
      .listEntries(day)
      .then((list) => alive && setEntries(list))
      .catch(() => alive && setEntries([]));
    return () => {
      alive = false;
    };
  }, [day, revision]);

  const total = entries?.reduce((a, e) => a + e.amountMl, 0) ?? 0;
  const sorted = entries ? [...entries].sort((a, b) => b.ts - a.ts || b.id - a.id) : [];

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-0.5">
        <h2 className="text-xs font-medium text-muted first-letter:uppercase">
          {day === today ? m.history.today : formatLongDate(parseDayKey(day))}
        </h2>
        <span className="text-xs text-subtle tabular-nums">
          {formatMl(total)} {m.ml}
        </span>
      </div>
      {entries && entries.length === 0 && (
        <p className="rounded-xl border border-dashed border-line py-5 text-center text-xs text-subtle">
          {m.history.noEntries}
        </p>
      )}
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {sorted.map((e) =>
          editing === e.id ? (
            <EditRow key={e.id} entry={e} onDone={() => setEditing(null)} />
          ) : (
            <EntryRow key={e.id} entry={e} onEdit={() => setEditing(e.id)} />
          ),
        )}
      </ul>
    </section>
  );
}

function EntryRow({ entry, onEdit }: { entry: Entry; onEdit: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const m = useT();

  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 3000);
    return () => clearTimeout(t);
  }, [confirm]);

  return (
    <li className="group flex h-11 items-center gap-3 px-3 text-sm">
      <span className="w-11 text-xs text-muted tabular-nums">{timeOfDay(entry.ts)}</span>
      <span className="flex-1 font-medium tabular-nums">
        {formatMl(entry.amountMl)} {m.ml}
      </span>
      {confirm ? (
        <button
          type="button"
          onClick={() => void aquaStore.getState().deleteEntry(entry)}
          className="rounded-md bg-danger/15 px-2 py-1 text-xs font-medium text-danger"
        >
          {m.history.confirmDelete}
        </button>
      ) : (
        <div className="flex gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
          <IconBtn label={m.history.edit} onClick={onEdit}>
            <Pencil className="size-3.5" />
          </IconBtn>
          <IconBtn label={m.history.delete} onClick={() => setConfirm(true)} danger>
            <Trash2 className="size-3.5" />
          </IconBtn>
        </div>
      )}
    </li>
  );
}

function EditRow({ entry, onDone }: { entry: Entry; onDone: () => void }) {
  const [amount, setAmount] = useState(String(entry.amountMl));
  const [time, setTime] = useState(timeOfDay(entry.ts));
  const [error, setError] = useState<string | null>(null);
  const m = useT();

  async function save() {
    const parsed = parseAmount(amount);
    if (!parsed.ok) return setError(parsed.error);
    if (!isValidTime(time)) return setError(m.errors.invalidTime);
    if (await aquaStore.getState().updateEntry(entry, parsed.value, time)) onDone();
  }

  return (
    <li className="px-3 py-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        onKeyDown={(e) => e.key === "Escape" && onDone()}
      >
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label={m.history.time}
          className={`${inputClass} w-[92px] px-2 py-1.5 text-xs`}
        />
        <div className="relative flex-1">
          <input
            autoFocus
            value={amount}
            inputMode="numeric"
            maxLength={8}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            aria-label={m.history.amountAria}
            className={`${inputClass} py-1.5 pr-8 text-xs`}
          />
          <span className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[11px] text-subtle">{m.ml}</span>
        </div>
        <IconBtn label={m.history.save} submit>
          <Check className="size-4 text-accent" />
        </IconBtn>
        <IconBtn label={m.history.cancel} onClick={onDone}>
          <X className="size-4" />
        </IconBtn>
      </form>
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
    </li>
  );
}

function IconBtn({
  label,
  onClick,
  danger,
  submit,
  children,
}: {
  label: string;
  onClick?: () => void;
  danger?: boolean;
  submit?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type={submit ? "submit" : "button"}
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`grid size-7 place-items-center rounded-md text-muted transition-colors ${
        danger ? "hover:bg-danger/15 hover:text-danger" : "hover:bg-surface-3 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
