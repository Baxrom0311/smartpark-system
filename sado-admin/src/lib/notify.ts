/**
 * Thin wrapper around `sonner`'s `toast` API that centralises how the
 * dashboard surfaces success and error notifications from mutations.
 *
 * The TanStack Query mutation hooks call into these helpers from their
 * existing `onSuccess` / `onError` callbacks — we deliberately do *not*
 * wrap `useMutation` itself (per the M60 build constraints) so each
 * mutation site keeps its own cache-invalidation semantics.
 */

import { toast } from "sonner";

import i18n from "@/i18n/config";

/**
 * Show a success toast. Call sites pass an optional already-translated
 * message; otherwise we fall back to the canonical "saved" copy.
 *
 * Centralising the fallback here means every mutation hook can call
 * `notifySuccess()` without each one having to hold its own copy of
 * the i18n key.
 */
export function notifySuccess(message?: string): void {
  const text = message ?? i18n.t("common.saved");
  toast.success(text);
}

/**
 * Show an error toast. Accepts either an `Error` instance (we read its
 * `message`) or a pre-formatted string. When neither is provided, we
 * fall back to the generic "server error" copy.
 */
export function notifyError(err: unknown): void {
  let text: string;
  if (typeof err === "string" && err.trim().length > 0) {
    text = err;
  } else if (err instanceof Error && err.message) {
    text = err.message;
  } else {
    text = i18n.t("errors.server");
  }
  toast.error(text);
}
