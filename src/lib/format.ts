const intFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const literFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const formatMl = (ml: number) => intFmt.format(Math.round(ml));

export function formatPercent(p: number): string {
  let v = Math.round(p * 10) / 10;
  // Never show "100%" before the goal is actually reached.
  if (p < 100 && v >= 100) v = 99.9;
  return `${pctFmt.format(v)}%`;
}

export const formatLiters = (ml: number) => `${literFmt.format(ml / 1000)} L`;

const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const shortDateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const longDateFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

export const formatWeekday = (d: Date) => weekdayFmt.format(d).replace(".", "");
export const formatShortDate = (d: Date) => shortDateFmt.format(d).replace(".", "");
export const formatLongDate = (d: Date) => longDateFmt.format(d);
