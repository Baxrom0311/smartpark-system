/**
 * AudioPlayer — small playback control for previewing a local
 * recording before submitting it to the API. Uses `expo-av`'s `Sound`
 * loader; the file URI is the path returned by the recorder.
 *
 * The component owns its own Sound lifetime and unloads on unmount so
 * we never leak audio sessions on iOS.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";

export interface AudioPlayerProps {
  uri: string;
  durationSec?: number;
  /** Accessible label for the play/pause button. */
  label: string;
}

function formatSeconds(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(total / 60)).padStart(1, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function AudioPlayer({
  uri,
  durationSec,
  label,
}: AudioPlayerProps): React.ReactElement {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const ensureSound = useCallback(async (): Promise<Audio.Sound | null> => {
    if (soundRef.current) return soundRef.current;
    try {
      const sound = new Audio.Sound();
      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
          if ("error" in status && status.error) {
            setLoadError(String(status.error));
          }
          return;
        }
        setIsPlaying(status.isPlaying);
        setPosition((status.positionMillis ?? 0) / 1000);
        if (status.didJustFinish) {
          setIsPlaying(false);
          void sound.setPositionAsync(0);
        }
      });
      await sound.loadAsync({ uri }, { shouldPlay: false });
      soundRef.current = sound;
      return sound;
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "load_failed");
      return null;
    }
  }, [uri]);

  useEffect(() => {
    return () => {
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) {
        void sound.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    // When the URI changes, drop the existing sound so the next play
    // call picks up the new file.
    const previous = soundRef.current;
    soundRef.current = null;
    setIsPlaying(false);
    setPosition(0);
    setLoadError(null);
    if (previous) {
      void previous.unloadAsync();
    }
  }, [uri]);

  const handlePress = useCallback(async () => {
    const sound = await ensureSound();
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.replayAsync();
    }
  }, [ensureSound, isPlaying]);

  const totalLabel =
    typeof durationSec === "number" && durationSec > 0
      ? formatSeconds(durationSec)
      : "--:--";

  return (
    <View className="flex-row items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy: isPlaying }}
        onPress={() => {
          void handlePress();
        }}
        className="h-10 w-10 items-center justify-center rounded-full bg-primary-600"
      >
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: isPlaying ? 0 : 10,
            borderTopWidth: 6,
            borderBottomWidth: 6,
            borderLeftColor: "#ffffff",
            borderTopColor: "transparent",
            borderBottomColor: "transparent",
          }}
        />
        {isPlaying ? (
          <View className="absolute h-3 w-3 bg-white" />
        ) : null}
      </Pressable>
      <View className="flex-1 gap-1">
        <Text className="text-sm font-medium text-neutral-900">{label}</Text>
        <Text className="text-xs text-neutral-500">
          {`${formatSeconds(position)} / ${totalLabel}`}
        </Text>
        {loadError != null ? (
          <Text className="text-xs text-risk-red">{loadError}</Text>
        ) : null}
      </View>
    </View>
  );
}
