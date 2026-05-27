/**
 * Text input field with label, error, and helper text. Wraps the
 * React Native `TextInput` so we get consistent styling across the
 * app and a focusable label that remains a tap target.
 */

import { useState } from "react";
import {
  TextInput,
  View,
  Text,
  type TextInputProps,
} from "react-native";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  helper?: string;
}

export function Input({
  label,
  error,
  helper,
  onFocus,
  onBlur,
  ...rest
}: InputProps): React.ReactElement {
  const [focused, setFocused] = useState(false);
  const hasError = error != null && error.length > 0;
  const borderClass = hasError
    ? "border-risk-red"
    : focused
      ? "border-primary-600"
      : "border-neutral-300";

  return (
    <View className="gap-1">
      {label != null ? (
        <Text className="text-sm font-medium text-neutral-700">{label}</Text>
      ) : null}
      <TextInput
        className={`rounded-xl border bg-white px-4 py-3 text-base text-neutral-900 ${borderClass}`}
        placeholderTextColor="#9ca3af"
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...rest}
      />
      {hasError ? (
        <Text className="text-xs text-risk-red">{error}</Text>
      ) : helper != null ? (
        <Text className="text-xs text-neutral-500">{helper}</Text>
      ) : null}
    </View>
  );
}
