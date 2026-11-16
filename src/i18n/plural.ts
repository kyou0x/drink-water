type Forms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

const rules = new Map<string, Intl.PluralRules>();

/** Picks the CLDR plural form of `n` for `locale` and replaces `#` with the number. */
export function plural(locale: string, n: number, forms: Forms): string {
  let r = rules.get(locale);
  if (!r) rules.set(locale, (r = new Intl.PluralRules(locale)));
  return (forms[r.select(n)] ?? forms.other).replace("#", String(n));
}
