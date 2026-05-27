/**
 * Tests for the parent reminder preferences service.
 *
 * Stores are kept in an in-memory AsyncStorage mock so the tests run
 * on a vanilla Node runtime. We verify:
 *   - defaults on first read
 *   - round-trip read/write
 *   - corrupt JSON falls back to defaults (not a throw)
 *   - update merges only the supplied keys
 *   - nextReminderDate produces correct relative offsets
 */

jest.mock("@react-native-async-storage/async-storage", () => {
  const memory = new Map<string, string>();
  return {
    setItem: jest.fn(async (key: string, value: string) => {
      memory.set(key, value);
    }),
    getItem: jest.fn(async (key: string) => memory.get(key) ?? null),
    removeItem: jest.fn(async (key: string) => {
      memory.delete(key);
    }),
    clear: jest.fn(async () => {
      memory.clear();
    }),
    __memory: memory,
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  __testing,
  clearReminderPreferences,
  nextReminderDate,
  readReminderPreferences,
  updateReminderPreferences,
  writeReminderPreferences,
  type AssessmentReminderPreferences,
} from "@/services/preferences";

const memory = (
  AsyncStorage as unknown as { __memory: Map<string, string> }
).__memory;

describe("preferences service", () => {
  beforeEach(() => {
    memory.clear();
  });

  it("returns defaults when nothing has been written", async () => {
    const result = await readReminderPreferences();
    expect(result).toEqual({ ...__testing.DEFAULTS });
  });

  it("round-trips a payload through write + read", async () => {
    const payload: AssessmentReminderPreferences = {
      enabled: true,
      frequency: "biweekly",
      lastScheduledAt: "2026-01-01T00:00:00.000Z",
    };
    await writeReminderPreferences(payload);
    expect(await readReminderPreferences()).toEqual(payload);
  });

  it("falls back to defaults when storage is corrupt", async () => {
    memory.set(__testing.STORAGE_KEY, "{not json");
    const result = await readReminderPreferences();
    expect(result).toEqual({ ...__testing.DEFAULTS });
  });

  it("normalises unknown frequency values to the default", async () => {
    memory.set(
      __testing.STORAGE_KEY,
      JSON.stringify({ enabled: true, frequency: "yearly" }),
    );
    const result = await readReminderPreferences();
    expect(result.frequency).toBe("weekly");
    expect(result.enabled).toBe(true);
    expect(result.lastScheduledAt).toBeNull();
  });

  it("merges patches via updateReminderPreferences", async () => {
    await writeReminderPreferences({
      enabled: false,
      frequency: "weekly",
      lastScheduledAt: null,
    });
    const result = await updateReminderPreferences({ enabled: true });
    expect(result.enabled).toBe(true);
    expect(result.frequency).toBe("weekly");
  });

  it("clearReminderPreferences removes the persisted blob", async () => {
    await writeReminderPreferences({
      enabled: true,
      frequency: "monthly",
      lastScheduledAt: null,
    });
    expect(memory.has(__testing.STORAGE_KEY)).toBe(true);
    await clearReminderPreferences();
    expect(memory.has(__testing.STORAGE_KEY)).toBe(false);
  });

  describe("nextReminderDate", () => {
    const FROM = new Date("2026-01-01T00:00:00.000Z");

    it("offsets by 7 days for weekly", () => {
      const next = nextReminderDate("weekly", FROM);
      expect(next.getTime() - FROM.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it("offsets by 14 days for biweekly", () => {
      const next = nextReminderDate("biweekly", FROM);
      expect(next.getTime() - FROM.getTime()).toBe(14 * 24 * 60 * 60 * 1000);
    });

    it("offsets by 30 days for monthly", () => {
      const next = nextReminderDate("monthly", FROM);
      expect(next.getTime() - FROM.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it("uses the current time as default origin", () => {
      const before = Date.now();
      const next = nextReminderDate("weekly");
      const after = Date.now();
      const diff = next.getTime();
      expect(diff).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000);
      expect(diff).toBeLessThanOrEqual(after + 7 * 24 * 60 * 60 * 1000);
    });
  });
});
