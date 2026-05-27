/**
 * Reminder scheduler — orchestrates the "schedule next assessment"
 * flow that fires when a parent finishes an assessment.
 *
 * The Settings screen lets a parent opt into local reminders and
 * pick a cadence; this module is the place where those preferences
 * are *acted on* — i.e. an OS-level local notification is queued so
 * the parent gets nudged to run the next assessment on time.
 *
 * Why a separate module
 * ---------------------
 * The Settings screen already imports services/notifications +
 * services/preferences directly. The results screen, however, is
 * called from many places (live polling, deep-link, offline replay)
 * and we don't want every caller to repeat the orchestration. This
 * module owns:
 *
 *   1. Reading current preferences.
 *   2. Skipping when reminders are disabled or already scheduled
 *      for this exact assessment id (idempotent — the analysis query
 *      may refetch a completed payload several times before the
 *      user navigates away).
 *   3. Probing the OS permission silently (no prompt — that's the
 *      Settings screen's job).
 *   4. Cancelling existing reminders + scheduling a fresh one with
 *      the cadence the parent picked.
 *   5. Persisting `lastScheduledAt` + `lastScheduledAssessmentId`
 *      so the UI can render "next reminder on …" and so we don't
 *      re-schedule on every refetch.
 *
 * The function is intentionally pure-async / dependency-free so
 * jest can mock the underlying notification + preferences modules
 * without touching native code.
 */

import {
  cancelAllReminders,
  requestPermissions,
  scheduleAssessmentReminder,
  type PermissionStatus,
} from "@/services/notifications";
import {
  nextReminderDate,
  readReminderPreferences,
  updateReminderPreferences,
  type AssessmentReminderPreferences,
  type ReminderFrequency,
} from "@/services/preferences";

export type ScheduleSkipReason =
  | "reminders-disabled"
  | "already-scheduled"
  | "permission-denied"
  | "scheduling-failed";

export type ScheduleNextAssessmentResult =
  | {
      status: "scheduled";
      scheduledFor: Date;
      identifier: string;
      frequency: ReminderFrequency;
    }
  | {
      status: "skipped";
      reason: ScheduleSkipReason;
      preferences: AssessmentReminderPreferences;
    };

export interface ScheduleNextAssessmentInput {
  /**
   * Id of the assessment that just completed. Used as the dedupe
   * key so refetches of the same `/analysis/:id` payload don't
   * re-schedule.
   */
  assessmentId: string;
  /** Id of the child the assessment was for — passed to the OS payload. */
  childId: string;
  /** Display name for the reminder copy. */
  childName: string;
  /** i18next translation for the reminder title (with `{name}` placeholder). */
  titleTemplate: string;
  /** i18next translation for the reminder body (with `{name}` placeholder). */
  bodyTemplate: string;
  /**
   * Override the "now" anchor — primarily a test seam. In production
   * we always anchor to `new Date()`.
   */
  now?: Date;
  /**
   * Override the OS permission probe — used by the results screen
   * which has already been told the permission status by the
   * notifications hook. When omitted we call `requestPermissions()`
   * which is a no-op probe when the user has already decided.
   */
  permissionOverride?: PermissionStatus;
}

/**
 * Auto-schedule a next-assessment reminder after an assessment
 * completes. Idempotent for a given `assessmentId`.
 *
 * The function never prompts the user — if permission is missing it
 * returns `{status: "skipped", reason: "permission-denied"}` so the
 * caller can route the user back to Settings.
 */
export async function scheduleNextAssessmentReminder(
  input: ScheduleNextAssessmentInput,
): Promise<ScheduleNextAssessmentResult> {
  const prefs = await readReminderPreferences();

  if (!prefs.enabled) {
    return { status: "skipped", reason: "reminders-disabled", preferences: prefs };
  }

  if (
    prefs.lastScheduledAssessmentId !== null &&
    prefs.lastScheduledAssessmentId === input.assessmentId
  ) {
    return { status: "skipped", reason: "already-scheduled", preferences: prefs };
  }

  const permission =
    input.permissionOverride ?? (await requestPermissions());
  if (permission !== "granted") {
    return { status: "skipped", reason: "permission-denied", preferences: prefs };
  }

  // Wipe any earlier reminders so the user only ever has one
  // "next assessment" notification queued — this matches the UX of
  // the Settings screen which also cancels-then-schedules.
  await cancelAllReminders();

  const targetDate = nextReminderDate(prefs.frequency, input.now ?? new Date());
  const reminder = await scheduleAssessmentReminder({
    childId: input.childId,
    childName: input.childName,
    scheduledFor: targetDate,
    titleTemplate: input.titleTemplate,
    bodyTemplate: input.bodyTemplate,
  });

  if (!reminder) {
    // The OS rejected the schedule (rare — usually because the
    // computed date is in the past). Keep prefs in sync so we don't
    // claim "scheduled" in the UI.
    const cleared = await updateReminderPreferences({
      lastScheduledAt: null,
      lastScheduledAssessmentId: null,
    });
    return {
      status: "skipped",
      reason: "scheduling-failed",
      preferences: cleared,
    };
  }

  await updateReminderPreferences({
    lastScheduledAt: targetDate.toISOString(),
    lastScheduledAssessmentId: input.assessmentId,
  });

  return {
    status: "scheduled",
    scheduledFor: targetDate,
    identifier: reminder.identifier,
    frequency: prefs.frequency,
  };
}
