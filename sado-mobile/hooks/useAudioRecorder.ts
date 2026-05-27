/**
 * `useAudioRecorder` — small state machine wrapping the audio service.
 *
 * States:
 *   - idle         : nothing is recording
 *   - permission   : permission prompt in flight
 *   - recording    : recorder is capturing audio
 *   - stopping     : finishing the recording / writing the file
 *   - finished     : last recording is available on `result`
 *   - error        : permission denied or device failure
 *
 * The hook also exposes `level` (0..1) so the UI can render a live
 * meter without subscribing to expo-av directly.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type ActiveRecorder,
  type FinishedRecording,
  MAX_DURATION_SEC,
  ensureMicrophonePermission,
  startRecording,
} from "@/services/audio";

export type RecorderStatus =
  | "idle"
  | "permission"
  | "recording"
  | "stopping"
  | "finished"
  | "error";

export interface AudioRecorderState {
  status: RecorderStatus;
  durationSec: number;
  level: number;
  result: FinishedRecording | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<FinishedRecording | null>;
  reset: () => void;
}

const METERING_FLOOR_DB = -60;

function meteringToLevel(metering: number | undefined): number {
  if (typeof metering !== "number" || !Number.isFinite(metering)) return 0;
  if (metering >= 0) return 1;
  if (metering <= METERING_FLOOR_DB) return 0;
  // Map [-60dB, 0dB] -> [0, 1] linearly (good enough for a meter).
  return (metering - METERING_FLOOR_DB) / -METERING_FLOOR_DB;
}

export function useAudioRecorder(maxSeconds: number = MAX_DURATION_SEC): AudioRecorderState {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [durationSec, setDurationSec] = useState(0);
  const [level, setLevel] = useState(0);
  const [result, setResult] = useState<FinishedRecording | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<ActiveRecorder | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (autoStopRef.current) {
        clearTimeout(autoStopRef.current);
        autoStopRef.current = null;
      }
      const unsubscribe = unsubscribeRef.current;
      if (unsubscribe) unsubscribe();
      const active = recorderRef.current;
      if (active) {
        void active.cancel();
        recorderRef.current = null;
      }
    };
  }, []);

  const cleanup = useCallback(() => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    recorderRef.current = null;
    stoppingRef.current = false;
  }, []);

  const stop = useCallback(async (): Promise<FinishedRecording | null> => {
    const active = recorderRef.current;
    if (!active || stoppingRef.current) return null;
    stoppingRef.current = true;
    setStatus("stopping");
    try {
      const finished = await active.stop();
      cleanup();
      if (isMountedRef.current) {
        setResult(finished);
        setDurationSec(finished.durationSec);
        setLevel(0);
        setStatus("finished");
      }
      return finished;
    } catch (err) {
      cleanup();
      if (isMountedRef.current) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Recording failed");
      }
      return null;
    }
  }, [cleanup]);

  const start = useCallback(async (): Promise<void> => {
    if (recorderRef.current) {
      // Defensive: cancel any leftover recorder before starting fresh.
      await recorderRef.current.cancel();
      cleanup();
    }
    setError(null);
    setResult(null);
    setDurationSec(0);
    setLevel(0);
    setStatus("permission");
    const granted = await ensureMicrophonePermission();
    if (!granted) {
      setStatus("error");
      setError("permission_denied");
      return;
    }

    try {
      const active = await startRecording();
      recorderRef.current = active;
      unsubscribeRef.current = active.onStatus((status) => {
        if (!isMountedRef.current) return;
        if (status.isRecording) {
          const ms = status.durationMillis ?? 0;
          setDurationSec(ms / 1000);
          setLevel(meteringToLevel(status.metering ?? undefined));
        }
      });
      autoStopRef.current = setTimeout(() => {
        void stop();
      }, maxSeconds * 1000);
      setStatus("recording");
    } catch (err) {
      cleanup();
      setStatus("error");
      setError(err instanceof Error ? err.message : "Recording failed");
    }
  }, [cleanup, maxSeconds, stop]);

  const reset = useCallback(() => {
    cleanup();
    setStatus("idle");
    setDurationSec(0);
    setLevel(0);
    setResult(null);
    setError(null);
  }, [cleanup]);

  return {
    status,
    durationSec,
    level,
    result,
    error,
    start,
    stop,
    reset,
  };
}
