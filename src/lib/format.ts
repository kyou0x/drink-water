import { getLocale } from "../i18n";

/** Formatters are rebuilt lazily whenever the active locale changes. */
let cached: { locale: string; f: ReturnType<typeof build> } | null = null;

function build(locale: string) {
  return {
    int: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    pct: new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }),
    liter: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }),
    shortDate: new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }),
    longDate: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }),
  };
}

function fmt() {
  const locale = getLocale();
  if (cached?.locale !== locale) cached = { locale, f: build(locale) };
  return cached.f;
}

export const formatMl = (ml: number) => fmt().int.format(Math.round(ml));

export function formatPercent(p: number): string {
  let v = Math.round(p * 10) / 10;
  // Never show "100%" before the goal is actually reached.
  if (p < 100 && v >= 100) v = 99.9;
  return fmt().pct.format(v / 100);
}

export const formatLiters = (ml: number) => `${fmt().liter.format(ml / 1000)} L`;

export const formatWeekday = (d: Date) => fmt().weekday.format(d).replace(".", "");
export const formatShortDate = (d: Date) => fmt().shortDate.format(d).replace(".", "");
export const formatLongDate = (d: Date) => fmt().longDate.format(d);
