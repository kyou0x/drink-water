import de from "./locales/de";
import en from "./locales/en";
import es from "./locales/es";
import fr from "./locales/fr";
import hi from "./locales/hi";
import id from "./locales/id";
import it from "./locales/it";
import ja from "./locales/ja";
import ko from "./locales/ko";
import nl from "./locales/nl";
import pl from "./locales/pl";
import ptBR from "./locales/pt-BR";
import ru from "./locales/ru";
import tr from "./locales/tr";
import uk from "./locales/uk";
import zhCN from "./locales/zh-CN";
import type { Messages } from "./types";

export type { Messages };

/** Supported UI languages, with their own (native) names. Keep in sync with `src-tauri/src/i18n.rs`. */
export const LOCALES = [
  { code: "en", name: "English", messages: en },
  { code: "pt-BR", name: "Português (Brasil)", messages: ptBR },
  { code: "es", name: "Español", messages: es },
  { code: "fr", name: "Français", messages: fr },
  { code: "de", name: "Deutsch", messages: de },
  { code: "it", name: "Italiano", messages: it },
  { code: "nl", name: "Nederlands", messages: nl },
  { code: "pl", name: "Polski", messages: pl },
  { code: "ru", name: "Русский", messages: ru },
  { code: "uk", name: "Українська", messages: uk },
  { code: "tr", name: "Türkçe", messages: tr },
  { code: "id", name: "Bahasa Indonesia", messages: id },
  { code: "hi", name: "हिन्दी", messages: hi },
  { code: "ja", name: "日本語", messages: ja },
  { code: "ko", name: "한국어", messages: ko },
  { code: "zh-CN", name: "简体中文", messages: zhCN },
] as const satisfies readonly { code: string; name: string; messages: Messages }[];

export type Locale = (typeof LOCALES)[number]["code"];
/** "auto" follows the operating system language. */
export type LanguagePref = Locale | "auto";

export const DEFAULT_LOCALE: Locale = "en";

const byCode = new Map<string, Messages>(LOCALES.map((l) => [l.code.toLowerCase(), l.messages]));

export const isLocale = (v: string): v is Locale => LOCALES.some((l) => l.code === v);
export const isLanguagePref = (v: string): v is LanguagePref => v === "auto" || isLocale(v);

/** Best supported match for a BCP 47 tag: exact ("pt-BR"), then by base language ("pt-PT" -> "pt-BR"). */
export function matchLocale(tag: string): Locale | null {
  const lower = tag.trim().replace("_", "-").toLowerCase();
  if (!lower) return null;
  const exact = LOCALES.find((l) => l.code.toLowerCase() === lower);
  if (exact) return exact.code;
  const base = lower.split("-")[0];
  return LOCALES.find((l) => l.code.toLowerCase().split("-")[0] === base)?.code ?? null;
}

export function systemLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

export function resolveLocale(pref: string, preferred: readonly string[] = systemLanguages()): Locale {
  if (pref !== "auto" && isLocale(pref)) return pref;
  for (const tag of preferred) {
    const m = matchLocale(tag);
    if (m) return m;
  }
  return DEFAULT_LOCALE;
}

let current: Locale = DEFAULT_LOCALE;

export function setLocale(locale: Locale) {
  current = locale;
  if (typeof document !== "undefined") document.documentElement.lang = locale;
}

export const getLocale = () => current;

/** Messages of the active locale. */
export const t = (): Messages => byCode.get(current.toLowerCase()) ?? en;
