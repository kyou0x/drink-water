import type { Settings } from "./types";

export const MIN_ENTRY_ML = 1;
export const MAX_ENTRY_ML = 5000;
export const MIN_GOAL_ML = 250;
export const MAX_GOAL_ML = 20000;
export const REMINDER_INTERVALS = [30, 45, 60, 90, 120] as const;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Parses user-typed amounts such as "420", " 420 ml", "1.000" (pt-BR thousands). */
export function parseAmount(input: string): Result<number> {
  const cleaned = input.trim().toLowerCase().replace(/\s*ml$/, "").replace(/\s+/g, "");
  if (cleaned === "") return { ok: false, error: "Informe uma quantidade." };
  if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(cleaned)) {
    return { ok: false, error: "Use apenas números inteiros (ml)." };
  }
  const value = Number(cleaned.replace(/\./g, ""));
  return validateAmount(value);
}

export function validateAmount(value: number): Result<number> {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return { ok: false, error: "Quantidade inválida." };
  }
  if (value < MIN_ENTRY_ML) return { ok: false, error: "A quantidade deve ser maior que zero." };
  if (value > MAX_ENTRY_ML) {
    return { ok: false, error: `Máximo de ${MAX_ENTRY_ML.toLocaleString("pt-BR")} ml por registro.` };
  }
  return { ok: true, value };
}

export function validateGoal(value: number): Result<number> {
  if (!Number.isFinite(value) || !Number.isInteger(value)) return { ok: false, error: "Meta inválida." };
  if (value < MIN_GOAL_ML || value > MAX_GOAL_ML) {
    return {
      ok: false,
      error: `A meta deve ficar entre ${MIN_GOAL_ML.toLocaleString("pt-BR")} e ${MAX_GOAL_ML.toLocaleString("pt-BR")} ml.`,
    };
  }
  return { ok: true, value };
}

export function isValidTime(value: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return false;
  return Number(m[1]) < 24 && Number(m[2]) < 60;
}

export function validateSettings(s: Settings): Result<Settings> {
  const goal = validateGoal(s.goalMl);
  if (!goal.ok) return goal;
  if (s.quickAmounts.length !== 4) return { ok: false, error: "Defina 4 botões rápidos." };
  for (const q of s.quickAmounts) {
    const r = validateAmount(q);
    if (!r.ok) return { ok: false, error: `Botão rápido: ${r.error}` };
  }
  if (!(REMINDER_INTERVALS as readonly number[]).includes(s.reminderIntervalMin)) {
    return { ok: false, error: "Intervalo de lembrete inválido." };
  }
  if (!isValidTime(s.reminderStart) || !isValidTime(s.reminderEnd)) {
    return { ok: false, error: "Horário inválido (use HH:MM)." };
  }
  if (s.reminderStart === s.reminderEnd) {
    return { ok: false, error: "Início e término dos lembretes não podem ser iguais." };
  }
  if (s.closeBehavior !== "tray" && s.closeBehavior !== "quit") {
    return { ok: false, error: "Comportamento ao fechar inválido." };
  }
  return { ok: true, value: s };
}
