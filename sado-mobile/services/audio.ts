/**
 * Audio service — thin wrapper around `expo-av` so screens never
 * have to touch the underlying recorder/player APIs directly.
 *
 * The app records to a single in-flight `Audio.Recording` instance.
 * Callers MUST stop the recording before starting a new one — the
 * `useAudioRecorder` hook enforces that contract.
 *
 * Recording format:
 *   - iOS:  AAC in an .m4a container @ 44.1kHz mono — Whisper-friendly
 *           and small enough to upload over 3G.
 *   - Android: same AAC/.m4a settings (HIGH_QUALITY preset adapted)
 *   - Web (Expo Go preview): defaults to webm/opus.
 *
 * The actual upload happens in `services/assessments.uploadRecording`.
 */

import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

const TAG = "[audio]";

export interface FinishedRecording {
  /** Local file URI (e.g. `file:///.../recording.m4a`). */
  uri: string;
  /** Best-effort duration in seconds. May be 0 if expo-av returns -1. */
  durationSec: number;
  /** Mime type derived from the file extension. */
  contentType: string;
  /** Size in bytes after writing to disk. */
  sizeBytes: number;
}

export const MAX_DURATION_SEC = 60;
export const MIN_DURATION_SEC = 1;

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: ".m4a",
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 96_000,
  },
  ios: {
    extension: ".m4a",
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 96_000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 128_000,
  },
};

export async function ensureMicrophonePermission(): Promise<boolean> {
  const existing = await Audio.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;
  const result = await Audio.requestPermissionsAsync();
  return result.granted;
}

export async function configureAudioMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });
}

function inferContentType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) return "audio/m4a";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  return "audio/m4a";
}

async function fileSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (info.exists && typeof info.size === "number") return info.size;
  } catch (error) {
    console.warn(`${TAG} fileSize failed`, error);
  }
  return 0;
}

export interface ActiveRecorder {
  /** Stop the current recording and return its file metadata. */
  stop: () => Promise<FinishedRecording>;
  /** Cancel the recording and discard the file. */
  cancel: () => Promise<void>;
  /** Subscribe to status updates. Returns an unsubscribe fn. */
  onStatus: (cb: (status: Audio.RecordingStatus) => void) => () => void;
}

export async function startRecording(): Promise<ActiveRecorder> {
  await configureAudioMode();
  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(RECORDING_OPTIONS);

  const listeners = new Set<(s: Audio.RecordingStatus) => void>();
  recording.setProgressUpdateInterval(200);
  recording.setOnRecordingStatusUpdate((status) => {
    for (const listener of listeners) listener(status);
  });

  await recording.startAsync();

  let stopped = false;
  return {
    stop: async () => {
      if (stopped) {
        const uri = recording.getURI() ?? "";
        return {
          uri,
          durationSec: 0,
          contentType: inferContentType(uri),
          sizeBytes: await fileSize(uri),
        };
      }
      stopped = true;
      try {
        await recording.stopAndUnloadAsync();
      } catch (error) {
        console.warn(`${TAG} stop failed`, error);
      }
      const uri = recording.getURI() ?? "";
      let durationMs = 0;
      try {
        const status = await recording.getStatusAsync();
        if (typeof status.durationMillis === "number") {
          durationMs = status.durationMillis;
        }
      } catch {
        // Recording is already unloaded — we'll fall back to 0.
      }
      return {
        uri,
        durationSec: Math.max(0, durationMs / 1000),
        contentType: inferContentType(uri),
        sizeBytes: await fileSize(uri),
      };
    },
    cancel: async () => {
      if (stopped) return;
      stopped = true;
      try {
        await recording.stopAndUnloadAsync();
      } catch {
        // Recording may already be unloaded — ignore.
      }
      const uri = recording.getURI();
      if (uri) {
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        } catch {
          // Best effort — temp files are GC'd on next app launch.
        }
      }
    },
    onStatus: (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

export async function deleteFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Best effort.
  }
}
