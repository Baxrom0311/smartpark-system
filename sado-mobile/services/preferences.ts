/**
 * User preferences service.
 *
 * Stores small client-side preferences in AsyncStorage. Today this
 * covers assessment reminder cadence (used by Settings + the local
 * notification scheduler). Kept as a typed, async-only API so screens
 * and stores never reach into storage directly.
 *
 * The shape is forward-compatible: when we read an unknown payload we
 * normalise it back to the defaults rather than throwing, so an older
 * client that wrote a partial blob still boots cleanly.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export const REMINDER_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;
export type ReminderFrequency = (typeof REMINDER_FREQUENCIES)[number];

export interface AssessmentReminderPreferences {
  /** Whether the parent has opted into local reminders. */
  enabled: boolean;
  /** Cadence for the next-assessment reminder. */
  frequency: ReminderFrequency;
  /** ISO timestamp of the last successful schedule, for diagnostics. */
  lastScheduledAt: string | null;
}

const STORAGE_KEY = "sado.mobile.preferences.v1";

const DEFAULTS: AssessmentReminderPreferences = {
  enabled: false,
  frequency: "weekly",
  lastScheduledAt: null,
};

function isFrequency(value: unknown): value is ReminderFrequency {
  return (
    typeof value === "string" &&
    (REMINDER_FREQUENCIES as readonly string[]).includes(value)
  );
}

function normalise(
  raw: unknown,
): AssessmentReminderPreferences {
  if (raw === null || typeof raw !== "object") return { ...DEFAULTS };
  const candidate = raw as Partial<AssessmentReminderPreferences>;
  return {
    enabled: candidate.enabled === true,
    frequency: isFrequency(candidate.frequency)
      ? candidate.frequency
      : DEFAULTS.frequency,
    lastScheduledAt:
      typeof candidate.lastScheduledAt === "string"
        ? candidate.lastScheduledAt
        : null,
  };
}

/** Read the parent's reminder preferences (returns defaults on miss). */
export async function readReminderPreferences(): Promise<AssessmentReminderPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULTS };
    return normalise(JSON.parse(raw));
  } catch {
    // Corrupt JSON or storage failure — fall back to defaults so the
    // settings screen still renders without erroring.
    return { ...DEFAULTS };
  }
}

/** Persist the parent's reminder preferences. */
export async function writeReminderPreferences(
  next: AssessmentReminderPreferences,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalise(next)));
}

/** Apply a partial patch and return the resulting record. */
export async function updateReminderPreferences(
  patch: Partial<AssessmentReminderPreferences>,
): Promise<AssessmentReminderPreferences> {
  const current = await readReminderPreferences();
  const next: AssessmentReminderPreferences = normalise({ ...current, ...patch });
  await writeReminderPreferences(next);
  return next;
}

/** Forget the user's preferences (used on logout). */
export async function clearReminderPreferences(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * Compute the next reminder Date given a frequency relative to `from`.
 * Exported so screens can both display the projected date and feed it
 * to `scheduleAssessmentReminder` in a single source of truth.
 */
export function nextReminderDate(
  frequency: ReminderFrequency,
  from: Date = new Date(),
): Date {
  const ms =
    frequency === "weekly"
      ? 7 * 24 * 60 * 60 * 1000
      : frequency === "biweekly"
        ? 14 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
  return new Date(from.getTime() + ms);
}

export const __testing = {
  STORAGE_KEY,
  DEFAULTS,
};
