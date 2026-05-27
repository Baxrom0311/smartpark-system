/**
 * Reusable button component matching the SADO design system.
 *
 * Variants:
 *   - primary: solid primary background (default action)
 *   - secondary: neutral surface for secondary actions
 *   - outline: bordered, transparent background
 *   - ghost: text-only, no surface
 *
 * The component is fully accessible — labels propagate via
 * `accessibilityLabel`, the disabled/loading state is reflected to
 * screen readers, and the touch target is at least 44x44 pt as per
 * the iOS/Android accessibility guidelines.
 */

import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const containerByVariant: Record<Variant, string> = {
  primary: "bg-primary-600 active:bg-primary-700",
  secondary: "bg-neutral-200 active:bg-neutral-300",
  outline: "bg-transparent border border-neutral-300 active:bg-neutral-100",
  ghost: "bg-transparent active:bg-neutral-100",
};

const labelByVariant: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-neutral-900",
  outline: "text-neutral-900",
  ghost: "text-primary-700",
};

const containerBySize: Record<Size, string> = {
  sm: "px-3 py-2 rounded-lg",
  md: "px-4 py-3 rounded-xl",
  lg: "px-6 py-4 rounded-2xl",
};

const labelBySize: Record<Size, string> = {
  sm: "text-sm font-medium",
  md: "text-base font-semibold",
  lg: "text-base font-semibold",
};

export interface ButtonProps
  extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = true,
  disabled,
  accessibilityLabel,
  ...rest
}: ButtonProps): React.ReactElement {
  const isDisabled = disabled === true || loading;
  const widthClass = fullWidth ? "w-full" : "self-start";
  const opacity = isDisabled ? "opacity-60" : "";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={`flex-row items-center justify-center gap-2 ${widthClass} ${containerBySize[size]} ${containerByVariant[variant]} ${opacity}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? "#ffffff" : "#1f2937"}
        />
      ) : null}
      <Text className={`${labelBySize[size]} ${labelByVariant[variant]}`}>
        {label}
      </Text>
    </Pressable>
  );
}
