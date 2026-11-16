/** Every user-facing string of the UI. `en` is the reference locale; all others must implement it fully. */
export interface Messages {
  /** Millilitre unit symbol. */
  ml: string;
  tabs: { today: string; history: string; settings: string };
  titleBar: { today: string; undo: string; minimize: string; close: string };
  load: { error: string; retry: string };
  toast: {
    /** `ml` is already formatted, e.g. "1,250". */
    added: (ml: string) => string;
    undone: (ml: string) => string;
    undo: string;
  };
  today: {
    /** `pct` is already formatted, e.g. "42.5%". */
    ofGoal: (pct: string) => string;
    goalReached: string;
    remaining: (ml: string) => string;
    customPlaceholder: string;
    customAria: string;
    add: string;
    addAria: string;
    bottleAria: (pct: number) => string;
  };
  history: {
    days7: string;
    days30: string;
    today: string;
    average: string;
    goalMet: string;
    goalMetValue: (met: number, total: number) => string;
    streak: string;
    streakValue: (days: number) => string;
    chartAria: string;
    chartGoal: string;
    noEntries: string;
    confirmDelete: string;
    edit: string;
    delete: string;
    time: string;
    amountAria: string;
    save: string;
    cancel: string;
  };
  settings: {
    goal: string;
    goalAria: string;
    /** `ml` is the formatted default goal. */
    disclaimer: (ml: string) => string;
    quick: string;
    quickAria: (n: number) => string;
    reminders: string;
    enableReminders: string;
    remindersHint: string;
    interval: string;
    minutes: (n: number) => string;
    start: string;
    end: string;
    system: string;
    autostart: string;
    autostartHint: string;
    onClose: string;
    closeTray: string;
    closeQuit: string;
    language: string;
    languageAuto: string;
    save: string;
    saved: string;
  };
  errors: {
    enterAmount: string;
    integersOnly: string;
    invalidAmount: string;
    amountPositive: string;
    amountMax: (max: string) => string;
    goalRange: (min: string, max: string) => string;
    quickCount: string;
    quickPrefix: (error: string) => string;
    invalidInterval: string;
    invalidTime: string;
    sameTimes: string;
    invalidClose: string;
    invalidLanguage: string;
    entryNotFound: string;
    nonexistentTime: string;
    futureTime: string;
    dbUnavailable: string;
    autostartFailed: string;
    unexpected: string;
  };
}
