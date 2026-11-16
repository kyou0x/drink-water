import { afterEach, describe, expect, it } from "vitest";
import { formatMl, formatPercent } from "../lib/format";
import { DEFAULT_SETTINGS } from "../lib/types";
import { validateAmount, validateSettings } from "../lib/validation";
import { getLocale, LOCALES, matchLocale, resolveLocale, setLocale, t, type Messages } from ".";
import en from "./locales/en";

afterEach(() => setLocale("en"));

/** Flattens a message tree into "path" -> sample output, calling functions with sample args. */
function flatten(obj: object, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix + k;
    if (typeof v === "string") out.set(key, v);
    else if (typeof v === "function") out.set(key, String((v as (...a: unknown[]) => unknown)(3, 7)));
    else for (const [ck, cv] of flatten(v as object, `${key}.`)) out.set(ck, cv);
  }
  return out;
}

describe("locales", () => {
  const reference = flatten(en);

  it("ships at least 14 languages with unique codes", () => {
    expect(LOCALES.length).toBeGreaterThanOrEqual(14);
    expect(new Set(LOCALES.map((l) => l.code)).size).toBe(LOCALES.length);
  });

  it.each(LOCALES.map((l) => [l.code, l.messages] as const))("%s translates every key", (_code, messages) => {
    const flat = flatten(messages as Messages);
    expect([...flat.keys()].sort()).toEqual([...reference.keys()].sort());
    for (const [key, value] of flat) expect(value.trim(), key).not.toBe("");
  });

  it("uses the right plural forms", () => {
    const ru = LOCALES.find((l) => l.code === "ru")!.messages.history.streakValue;
    expect([1, 2, 5, 21].map(ru)).toEqual(["1 день", "2 дня", "5 дней", "21 день"]);
    const pl = LOCALES.find((l) => l.code === "pl")!.messages.history.streakValue;
    expect([1, 3, 5].map(pl)).toEqual(["1 dzień", "3 dni", "5 dni"]);
    expect([1, 2].map(en.history.streakValue)).toEqual(["1 day", "2 days"]);
  });
});

describe("resolveLocale", () => {
  it("honours an explicit choice", () => {
    expect(resolveLocale("ja", ["pt-BR"])).toBe("ja");
  });

  it("follows the system for auto", () => {
    expect(resolveLocale("auto", ["pt-BR", "en-US"])).toBe("pt-BR");
    expect(resolveLocale("auto", ["pt-PT"])).toBe("pt-BR");
    expect(resolveLocale("auto", ["zh-Hans-CN"])).toBe("zh-CN");
    expect(resolveLocale("auto", ["de_AT"])).toBe("de");
    expect(resolveLocale("auto", ["xx", "fr-CA"])).toBe("fr");
  });

  it("falls back to English", () => {
    expect(resolveLocale("auto", ["sw-KE"])).toBe("en");
    expect(resolveLocale("klingon", [])).toBe("en");
    expect(matchLocale("")).toBeNull();
  });
});

describe("localized output", () => {
  it("formats numbers per locale", () => {
    setLocale("en");
    expect(formatMl(4500)).toBe("4,500");
    expect(formatPercent(16.66)).toBe("16.7%");
    setLocale("de");
    expect(formatMl(4500)).toBe("4.500");
    expect(getLocale()).toBe("de");
  });

  it("translates validation errors", () => {
    setLocale("es");
    expect(validateAmount(0)).toEqual({ ok: false, error: "La cantidad debe ser mayor que cero." });
    setLocale("en");
    expect(validateAmount(6000)).toEqual({ ok: false, error: "Maximum of 5,000 ml per entry." });
    expect(t().tabs.history).toBe("History");
  });

  it("rejects unknown languages in settings", () => {
    expect(validateSettings({ ...DEFAULT_SETTINGS, language: "ja" }).ok).toBe(true);
    expect(validateSettings({ ...DEFAULT_SETTINGS, language: "xx" as never }).ok).toBe(false);
  });
});
