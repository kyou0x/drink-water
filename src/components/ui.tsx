import type { ReactNode } from "react";

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? "bg-accent-strong" : "bg-surface-3"
      }`}
    >
      <span
        className={`absolute top-[3px] left-[3px] size-4 rounded-full bg-white shadow transition-transform duration-200 ease-out-expo ${
          checked ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex rounded-lg bg-surface p-0.5 ${disabled ? "opacity-40" : ""}`}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            o.value === value ? "bg-surface-3 text-fg shadow-sm" : "text-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-[11px] font-semibold tracking-wider text-subtle uppercase">{title}</h2>
      {children}
    </section>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg tabular-nums outline-none transition-colors placeholder:text-subtle focus:border-accent/50 disabled:opacity-40";
