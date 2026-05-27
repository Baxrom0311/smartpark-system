/**
 * RewardAnimation — full-screen overlay shown when the child finishes
 * a task or exercise. Plays a star explosion + scaling label, then
 * auto-dismisses after `durationMs`.
 *
 * Implemented entirely with `react-native-reanimated` so the animation
 * runs on the UI thread and never tears even when JS is busy.
 */

import { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { GameCharacter } from "@/components/game/GameCharacter";

export interface RewardAnimationProps {
  visible: boolean;
  label: string;
  /** Total time the overlay stays on screen, in ms. */
  durationMs?: number;
  onDone?: () => void;
}

interface StarConfig {
  angle: number;
  color: string;
  size: number;
}

const STARS: readonly StarConfig[] = [
  { angle: 0, color: "#f59e0b", size: 18 },
  { angle: 45, color: "#ef4444", size: 14 },
  { angle: 90, color: "#10b981", size: 16 },
  { angle: 135, color: "#3b82f6", size: 14 },
  { angle: 180, color: "#a855f7", size: 18 },
  { angle: 225, color: "#ec4899", size: 14 },
  { angle: 270, color: "#22d3ee", size: 16 },
  { angle: 315, color: "#fde047", size: 14 },
] as const;

const screen = Dimensions.get("window");

function StarBurst({
  config,
  progress,
}: {
  config: StarConfig;
  progress: Animated.SharedValue<number>;
}): React.ReactElement {
  const radians = (config.angle * Math.PI) / 180;
  const animated = useAnimatedStyle(() => {
    const distance = 130 * progress.value;
    return {
      transform: [
        { translateX: Math.cos(radians) * distance },
        { translateY: Math.sin(radians) * distance },
        { scale: 0.6 + progress.value * 0.7 },
      ],
      opacity: 1 - progress.value * 0.6,
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: config.color,
        },
        animated,
      ]}
    />
  );
}

export function RewardAnimation({
  visible,
  label,
  durationMs = 1800,
  onDone,
}: RewardAnimationProps): React.ReactElement | null {
  const progress = useSharedValue(0);
  const labelScale = useSharedValue(0.4);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(progress);
      cancelAnimation(labelScale);
      progress.value = 0;
      labelScale.value = 0.4;
      return;
    }

    progress.value = 0;
    labelScale.value = 0.4;

    progress.value = withTiming(1, {
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
    });
    labelScale.value = withSequence(
      withTiming(1.15, { duration: 280, easing: Easing.out(Easing.back(1.5)) }),
      withTiming(1, { duration: 240 }),
    );

    const handle = setTimeout(() => {
      onDone?.();
    }, durationMs);

    // Optional graceful fade — done by the caller swapping `visible`.
    progress.value = withDelay(
      0,
      withTiming(1, {
        duration: durationMs,
        easing: Easing.out(Easing.cubic),
      }),
    );

    return () => {
      clearTimeout(handle);
      cancelAnimation(progress);
      cancelAnimation(labelScale);
    };
  }, [visible, durationMs, onDone, progress, labelScale]);

  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ scale: labelScale.value }],
  }));

  if (!visible) return null;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.overlay]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
    >
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <View style={styles.starsContainer}>
          {STARS.map((star) => (
            <StarBurst
              key={`${star.angle}-${star.color}`}
              config={star}
              progress={progress}
            />
          ))}
          <GameCharacter mood="celebrate" size={140} />
        </View>
        <Animated.Text style={[styles.label, labelStyle]}>{label}</Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  starsContainer: {
    width: Math.min(260, screen.width * 0.7),
    height: Math.min(260, screen.width * 0.7),
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    marginTop: 24,
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
});
