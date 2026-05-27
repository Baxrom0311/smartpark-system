/**
 * GameCharacter — animated friendly companion shown during the
 * gamified assessment / exercise flow.
 *
 * The character is a simple SVG-style composition (circle body +
 * eyes + mouth) rendered with React Native's primitives so we don't
 * need any image asset pipeline. The mood prop drives small animated
 * variations:
 *   - "idle"      : gentle breathing animation
 *   - "listening" : pulses in time with the recording level
 *   - "celebrate" : bouncy reward dance (used on `RewardAnimation`)
 *   - "thinking"  : slow head-tilt
 */

import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export type CharacterMood = "idle" | "listening" | "celebrate" | "thinking";

export interface GameCharacterProps {
  mood?: CharacterMood;
  /** 0..1, used when mood is `listening` to scale the body. */
  level?: number;
  size?: number;
}

export function GameCharacter({
  mood = "idle",
  level = 0,
  size = 160,
}: GameCharacterProps): React.ReactElement {
  const breathe = useSharedValue(1);
  const tilt = useSharedValue(0);

  useEffect(() => {
    breathe.value = 1;
    tilt.value = 0;

    if (mood === "idle") {
      breathe.value = withRepeat(
        withTiming(1.04, {
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
      );
    } else if (mood === "thinking") {
      tilt.value = withRepeat(
        withSequence(
          withTiming(-6, { duration: 700 }),
          withTiming(6, { duration: 700 }),
        ),
        -1,
        true,
      );
    } else if (mood === "celebrate") {
      breathe.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 280 }),
          withTiming(0.95, { duration: 280 }),
        ),
        -1,
        true,
      );
    }
  }, [mood, breathe, tilt]);

  const bodyStyle = useAnimatedStyle(() => {
    const listenScale = mood === "listening" ? 1 + level * 0.15 : 1;
    return {
      transform: [
        { scale: breathe.value * listenScale },
        { rotate: `${tilt.value}deg` },
      ],
    };
  });

  const eye = size * 0.1;
  const eyeOffset = size * 0.18;
  const mouthWidth = size * 0.25;
  const mouthHeight = mood === "celebrate" ? size * 0.18 : size * 0.06;
  const cheek = size * 0.08;

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel="character"
    >
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: "#fde68a",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 6,
          },
          bodyStyle,
        ]}
      >
        {/* Eyes */}
        <View
          style={{
            flexDirection: "row",
            gap: eyeOffset,
            marginBottom: size * 0.05,
          }}
        >
          <View
            style={{
              width: eye,
              height: eye,
              borderRadius: eye / 2,
              backgroundColor: "#1f2937",
            }}
          />
          <View
            style={{
              width: eye,
              height: eye,
              borderRadius: eye / 2,
              backgroundColor: "#1f2937",
            }}
          />
        </View>
        {/* Mouth */}
        <View
          style={{
            width: mouthWidth,
            height: mouthHeight,
            borderRadius: mouthHeight / 2,
            backgroundColor: "#dc2626",
          }}
        />
        {/* Cheeks (only when celebrating) */}
        {mood === "celebrate" ? (
          <View
            style={{
              position: "absolute",
              flexDirection: "row",
              top: size * 0.55,
              gap: size * 0.5,
            }}
          >
            <View
              style={{
                width: cheek,
                height: cheek * 0.7,
                borderRadius: cheek,
                backgroundColor: "#fca5a5",
                opacity: 0.8,
              }}
            />
            <View
              style={{
                width: cheek,
                height: cheek * 0.7,
                borderRadius: cheek,
                backgroundColor: "#fca5a5",
                opacity: 0.8,
              }}
            />
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}
