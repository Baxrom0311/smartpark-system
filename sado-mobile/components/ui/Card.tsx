/**
 * Card surface component. Used as the outermost container for
 * grouped content (children profiles, exercise tiles, etc.).
 *
 * The card respects the light/dark color tokens defined in
 * `tailwind.config.js` so it picks up the right surface color when
 * the system theme changes.
 */

import { View, type ViewProps } from "react-native";

export interface CardProps extends ViewProps {
  variant?: "default" | "elevated" | "outline";
  padding?: "none" | "sm" | "md" | "lg";
}

const variantClass: Record<NonNullable<CardProps["variant"]>, string> = {
  default: "bg-white",
  elevated: "bg-white shadow-md",
  outline: "bg-white border border-neutral-200",
};

const paddingClass: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Card({
  variant = "default",
  padding = "md",
  className,
  children,
  ...rest
}: CardProps): React.ReactElement {
  const composed = `${variantClass[variant]} ${paddingClass[padding]} rounded-2xl ${className ?? ""}`;
  return (
    <View className={composed} {...rest}>
      {children}
    </View>
  );
}
