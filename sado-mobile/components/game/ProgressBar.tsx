/**
 * Animated progress bar used in the gamified assessment flow.
 *
 * Drives a Reanimated worklet so the fill animates at 60fps even
 * when JS is busy. The bar is purely presentational — current step
 * is owned by `useAssessmentStore`.
 */

import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
}

export function ProgressBar({
  current,
  total,
  label,
}: ProgressBarProps): React.ReactElement {
  const ratio = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;
  const width = useSharedValue(ratio);

  useEffect(() => {
    width.value = withTiming(ratio, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });
  }, [ratio, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${Math.round(width.value * 100)}%`,
  }));

  return (
    <View className="gap-2">
      {label != null ? (
        <Text className="text-sm font-medium text-neutral-700">{label}</Text>
      ) : null}
      <View className="h-3 w-full overflow-hidden rounded-full bg-neutral-200">
        <Animated.View
          style={animatedStyle}
          className="h-full rounded-full bg-primary-600"
        />
      </View>
    </View>
  );
}
