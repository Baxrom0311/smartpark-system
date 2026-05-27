/**
 * AudioRecorder UI — large microphone button with a live level meter.
 *
 * The component is purely presentational: state is owned by the
 * `useAudioRecorder` hook so the parent screen can sequence multiple
 * recordings without losing UI control.
 */

import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Badge } from "@/components/ui/Badge";
import type { RecorderStatus } from "@/hooks/useAudioRecorder";

export interface AudioRecorderProps {
  status: RecorderStatus;
  durationSec: number;
  level: number;
  maxSeconds: number;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  labels: {
    tapToRecord: string;
    recording: string;
    stop: string;
    retry: string;
    permissionDenied: string;
  };
}

function formatSeconds(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(total / 60)).padStart(1, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function AudioRecorder({
  status,
  durationSec,
  level,
  maxSeconds,
  onStart,
  onStop,
  onReset,
  labels,
}: AudioRecorderProps): React.ReactElement {
  const isRecording = status === "recording";
  const isBusy = status === "permission" || status === "stopping";
  const showError = status === "error";

  const scale = useSharedValue(1);
  const ring = useSharedValue(0);

  useEffect(() => {
    if (isRecording) {
      scale.value = withRepeat(
        withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [isRecording, scale]);

  // Ring expands with the live audio level (0..1) for visible feedback.
  useEffect(() => {
    ring.value = withTiming(Math.min(1, Math.max(0, level)), { duration: 120 });
  }, [level, ring]);

  const animatedScale = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const animatedRing = useAnimatedStyle(() => ({
    opacity: 0.25 + ring.value * 0.55,
    transform: [{ scale: 1 + ring.value * 0.4 }],
  }));

  const handlePress = (): void => {
    if (isRecording) onStop();
    else if (showError) onReset();
    else onStart();
  };

  const buttonLabel = isRecording
    ? labels.stop
    : showError
      ? labels.retry
      : labels.tapToRecord;

  const remaining = Math.max(0, maxSeconds - durationSec);

  return (
    <View className="items-center gap-4">
      <View className="h-44 w-44 items-center justify-center">
        <Animated.View
          style={animatedRing}
          className="absolute h-44 w-44 rounded-full bg-primary-500"
        />
        <Animated.View style={animatedScale} className="h-32 w-32 items-center justify-center rounded-full bg-primary-600 shadow-lg">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={buttonLabel}
            accessibilityState={{ disabled: isBusy, busy: isBusy }}
            disabled={isBusy}
            onPress={handlePress}
            className="h-32 w-32 items-center justify-center rounded-full"
          >
            <View className="h-16 w-16 rounded-full bg-white" />
          </Pressable>
        </Animated.View>
      </View>

      <View className="items-center gap-1">
        <Text className="text-2xl font-bold text-neutral-900">
          {formatSeconds(durationSec)}
        </Text>
        <Text className="text-xs text-neutral-500">
          {`-${formatSeconds(remaining)} / ${formatSeconds(maxSeconds)}`}
        </Text>
      </View>

      <View className="h-8">
        {isRecording ? (
          <Badge tone="red" label={labels.recording} />
        ) : showError ? (
          <Badge tone="red" label={labels.permissionDenied} />
        ) : null}
      </View>
    </View>
  );
}
