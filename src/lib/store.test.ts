import { beforeEach, describe, expect, it } from "vitest";
import { createFakeApi } from "../test/fakeApi";
import { createAquaStore, DUPLICATE_WINDOW_MS } from "./store";
import { computeProgress } from "./hydration";

function setup(start = new Date(2026, 10, 15, 10, 0, 0)) {
  const clock = { now: start };
  const fake = createFakeApi(clock);
  const store = createAquaStore(fake.api, () => clock.now);
  const advance = (ms: number) => {
    clock.now = new Date(clock.now.getTime() + ms);
  };
  const total = () => store.getState().totals[store.getState().today] ?? 0;
  return { clock, fake, store, advance, total };
}

describe("store: registering intake", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(async () => {
    t = setup();
    await t.store.getState().init();
  });

  it("starts empty with the 4.500 ml goal", () => {
    expect(t.store.getState().status).toBe("ready");
    expect(t.total()).toBe(0);
    expect(t.store.getState().settings.goalMl).toBe(4500);
  });

  it("adds quick and custom amounts and persists them", async () => {
    await t.store.getState().add(500);
    t.advance(60_000);
    await t.store.getState().add(250);
    t.advance(60_000);
    await t.store.getState().add(420);
    expect(t.total()).toBe(1170);
    expect(t.store.getState().todayEntries).toHaveLength(3);
    expect(t.fake.entries).toHaveLength(3);
  });

  it("ignores accidental double clicks", async () => {
    await Promise.all([t.store.getState().add(250), t.store.getState().add(250)]);
    expect(t.fake.calls).toEqual(["add:250"]);
    t.advance(DUPLICATE_WINDOW_MS - 100);
    await t.store.getState().add(250);
    expect(t.fake.calls).toEqual(["add:250"]);
    t.advance(DUPLICATE_WINDOW_MS);
    await t.store.getState().add(250);
    expect(t.fake.calls).toEqual(["add:250", "add:250"]);
    expect(t.total()).toBe(500);
  });

  it("rejects invalid amounts without touching storage", async () => {
    for (const v of [0, -100, 1.5, Number.NaN, 99999]) {
      expect(await t.store.getState().add(v)).toBe(false);
    }
    expect(t.fake.calls).toHaveLength(0);
    expect(t.store.getState().toast?.kind).toBe("error");
  });

  it("undoes the last entry", async () => {
    await t.store.getState().add(500);
    t.advance(60_000);
    await t.store.getState().add(350);
    await t.store.getState().undoLast();
    expect(t.total()).toBe(500);
    expect(t.fake.entries.map((e) => e.amountMl)).toEqual([500]);
  });

  it("keeps counting past the goal and celebrates once when crossing it", async () => {
    for (let i = 0; i < 9; i++) {
      await t.store.getState().add(500);
      t.advance(60_000);
    }
    expect(t.total()).toBe(4500);
    expect(t.store.getState().celebrate).toBe(1);
    await t.store.getState().add(350);
    expect(t.total()).toBe(4850);
    expect(t.store.getState().celebrate).toBe(1);
    const p = computeProgress(t.total(), t.store.getState().settings.goalMl);
    expect(p.fill).toBe(1);
    expect(p.surplusMl).toBe(350);
  });
});

describe("store: editing and deleting", () => {
  it("edits amount and time of an entry and updates totals", async () => {
    const t = setup();
    await t.store.getState().init();
    await t.store.getState().add(250);
    const entry = t.store.getState().todayEntries[0]!;
    expect(await t.store.getState().updateEntry(entry, 400, "07:30")).toBe(true);
    const updated = t.store.getState().todayEntries[0]!;
    expect(updated.amountMl).toBe(400);
    expect(new Date(updated.ts).getHours()).toBe(7);
    expect(updated.day).toBe(entry.day);
    expect(t.total()).toBe(400);
  });

  it("rejects invalid edits", async () => {
    const t = setup();
    await t.store.getState().init();
    await t.store.getState().add(250);
    const entry = t.store.getState().todayEntries[0]!;
    expect(await t.store.getState().updateEntry(entry, -5, "07:30")).toBe(false);
    expect(t.total()).toBe(250);
  });

  it("deletes an entry and updates totals", async () => {
    const t = setup();
    await t.store.getState().init();
    await t.store.getState().add(250);
    t.advance(60_000);
    await t.store.getState().add(500);
    const first = t.store.getState().todayEntries[0]!;
    await t.store.getState().deleteEntry(first);
    expect(t.total()).toBe(500);
    expect(t.fake.entries).toHaveLength(1);
  });

  it("edits and deletes entries from previous days without touching today", async () => {
    const t = setup();
    t.fake.seed({ amountMl: 1000, ts: new Date(2026, 10, 14, 9).getTime(), day: "2026-11-14" });
    t.fake.seed({ amountMl: 600, ts: new Date(2026, 10, 14, 12).getTime(), day: "2026-11-14" });
    await t.store.getState().init();
    await t.store.getState().add(300);
    const [a, b] = await t.store.getState().listEntries("2026-11-14");
    await t.store.getState().updateEntry(a!, 1200, "09:00");
    expect(t.store.getState().totals["2026-11-14"]).toBe(1800);
    await t.store.getState().deleteEntry(b!);
    expect(t.store.getState().totals["2026-11-14"]).toBe(1200);
    expect(t.total()).toBe(300);
  });

  it("surfaces backend errors as toasts", async () => {
    const t = setup();
    await t.store.getState().init();
    const ok = await t.store.getState().deleteEntry({ id: 999, amountMl: 1, ts: 0, day: "2026-11-15" });
    expect(ok).toBe(false);
    expect(t.store.getState().toast).toMatchObject({ kind: "error", message: "Registro não encontrado." });
  });
});

describe("store: day rollover", () => {
  it("resets visual progress at midnight but keeps history", async () => {
    const t = setup(new Date(2026, 10, 15, 23, 58));
    await t.store.getState().init();
    await t.store.getState().add(500);
    expect(t.total()).toBe(500);

    t.advance(3 * 60_000); // 00:01 of the next day
    expect(await t.store.getState().checkDayRollover()).toBe(true);
    const s = t.store.getState();
    expect(s.today).toBe("2026-11-16");
    expect(s.todayEntries).toHaveLength(0);
    expect(t.total()).toBe(0);
    expect(s.totals["2026-11-15"]).toBe(500);
  });

  it("is a no-op when the day did not change", async () => {
    const t = setup();
    await t.store.getState().init();
    t.advance(60_000);
    expect(await t.store.getState().checkDayRollover()).toBe(false);
  });

  it("assigns entries added after midnight (app left open) to the new day", async () => {
    const t = setup(new Date(2026, 10, 15, 23, 59, 30));
    await t.store.getState().init();
    await t.store.getState().add(250);
    t.advance(60_000);
    await t.store.getState().add(350);
    const s = t.store.getState();
    expect(s.today).toBe("2026-11-16");
    expect(s.todayEntries.map((e) => e.amountMl)).toEqual([350]);
    expect(s.totals["2026-11-15"]).toBe(250);
    expect(s.totals["2026-11-16"]).toBe(350);
  });

  it("undo only targets today's entries", async () => {
    const t = setup(new Date(2026, 10, 15, 23, 59));
    await t.store.getState().init();
    await t.store.getState().add(250);
    t.advance(2 * 60_000);
    await t.store.getState().checkDayRollover();
    expect(await t.store.getState().undoLast()).toBe(false);
    expect(t.fake.entries).toHaveLength(1);
  });
});

describe("store: settings", () => {
  it("changes the goal", async () => {
    const t = setup();
    await t.store.getState().init();
    const s = t.store.getState().settings;
    expect(await t.store.getState().saveSettings({ ...s, goalMl: 3000 })).toBeNull();
    expect(t.store.getState().settings.goalMl).toBe(3000);
  });

  it("refuses invalid settings", async () => {
    const t = setup();
    await t.store.getState().init();
    const s = t.store.getState().settings;
    expect(await t.store.getState().saveSettings({ ...s, goalMl: -1 })).toMatch(/meta/i);
    expect(t.store.getState().settings.goalMl).toBe(4500);
  });
});
