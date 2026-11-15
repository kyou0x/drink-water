import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import type { Settings } from "../lib/types";
import { REMINDER_INTERVALS } from "../lib/validation";
import { aquaStore, useAqua } from "../state";
import { inputClass, Section, Segmented, Switch } from "./ui";

/** Numeric fields are edited as text so partial input ("", "4") doesn't fight the user. */
type Draft = Omit<Settings, "goalMl" | "quickAmounts"> & { goalMl: string; quickAmounts: string[] };

const toDraft = (s: Settings): Draft => ({
  ...s,
  goalMl: String(s.goalMl),
  quickAmounts: s.quickAmounts.map(String),
});

const toNumber = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : Number.NaN);

const fromDraft = (d: Draft): Settings => ({
  ...d,
  goalMl: toNumber(d.goalMl),
  quickAmounts: d.quickAmounts.map(toNumber),
});

export function SettingsView() {
  const settings = useAqua((s) => s.settings);
  const [draft, setDraft] = useState(() => toDraft(settings));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 1800);
    return () => clearTimeout(t);
  }, [saved]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(settings));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  };

  async function save() {
    setSaving(true);
    const err = await aquaStore.getState().saveSettings(fromDraft(draft));
    setSaving(false);
    if (err) {
      setError(err);
    } else {
      setDraft(toDraft(aquaStore.getState().settings));
      setSaved(true);
    }
  }

  const remindersOff = !draft.remindersEnabled;

  return (
    <div className="view flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-5 pt-1 pb-4">
        <Section title="Meta diária">
          <div className="relative">
            <input
              value={draft.goalMl}
              onChange={(e) => set("goalMl", e.target.value)}
              inputMode="numeric"
              maxLength={6}
              aria-label="Meta diária em ml"
              className={`${inputClass} pr-10`}
            />
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-subtle">ml</span>
          </div>
          <p className="text-[11px] leading-relaxed text-subtle">
            O valor padrão de 4.500 ml é apenas um ponto de partida, não uma recomendação médica. A necessidade de
            água varia de pessoa para pessoa.
          </p>
        </Section>

        <Section title="Botões rápidos (ml)">
          <div className="grid grid-cols-4 gap-2">
            {draft.quickAmounts.map((v, i) => (
              <input
                key={i}
                value={v}
                inputMode="numeric"
                maxLength={4}
                aria-label={`Botão rápido ${i + 1}`}
                onChange={(e) => {
                  const next = [...draft.quickAmounts];
                  next[i] = e.target.value;
                  set("quickAmounts", next);
                }}
                className={`${inputClass} text-center`}
              />
            ))}
          </div>
        </Section>

        <Section title="Lembretes">
          <Row label="Ativar lembretes" hint="Não são enviados após atingir a meta do dia.">
            <Switch label="Ativar lembretes" checked={draft.remindersEnabled} onChange={(v) => set("remindersEnabled", v)} />
          </Row>
          <div className="space-y-1.5">
            <span className={`text-xs text-muted ${remindersOff ? "opacity-40" : ""}`}>Intervalo</span>
            <Segmented
              disabled={remindersOff}
              value={draft.reminderIntervalMin}
              onChange={(v) => set("reminderIntervalMin", v)}
              options={REMINDER_INTERVALS.map((m) => ({ value: m, label: `${m} min` }))}
            />
          </div>
          <div className={`grid grid-cols-2 gap-2 ${remindersOff ? "opacity-40" : ""}`}>
            <label className="space-y-1.5">
              <span className="text-xs text-muted">Início</span>
              <input
                type="time"
                disabled={remindersOff}
                value={draft.reminderStart}
                onChange={(e) => set("reminderStart", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-muted">Término</span>
              <input
                type="time"
                disabled={remindersOff}
                value={draft.reminderEnd}
                onChange={(e) => set("reminderEnd", e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        </Section>

        <Section title="Sistema">
          <Row label="Iniciar com o Windows" hint="Abre minimizado na bandeja.">
            <Switch label="Iniciar com o Windows" checked={draft.autostart} onChange={(v) => set("autostart", v)} />
          </Row>
          <div className="space-y-1.5">
            <span className="text-xs text-muted">Ao fechar a janela</span>
            <Segmented
              value={draft.closeBehavior}
              onChange={(v) => set("closeBehavior", v)}
              options={[
                { value: "tray", label: "Manter na bandeja" },
                { value: "quit", label: "Encerrar o Aqua" },
              ]}
            />
          </div>
        </Section>
      </div>

      <div className="shrink-0 border-t border-line px-5 pt-3 pb-3">
        {error && <p className="mb-2 text-[11px] text-danger">{error}</p>}
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void save()}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-accent-strong text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:bg-surface-2 disabled:text-subtle"
        >
          {saved && !dirty ? (
            <>
              <Check className="size-4" /> Salvo
            </>
          ) : (
            "Salvar alterações"
          )}
        </button>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] text-subtle">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
