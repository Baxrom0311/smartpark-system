/**
 * OfflineIndicator — compact pill that reflects connectivity and the
 * pending upload-queue size. Designed to live in screen headers:
 *
 *   - "Onlayn" tone=green when connectivity is online and queue empty
 *   - "Sinxronlash…" tone=info while a flush is in progress
 *   - "{n} ta yozuv navbatda" tone=yellow when queue is non-empty
 *   - "Oflayn" tone=red when connectivity is offline
 *
 * The component reads from the offline store directly so it works
 * inside any screen without prop drilling.
 */

import { useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import {
  selectDeadCount,
  selectIsOffline,
  selectPendingCount,
  useOfflineStore,
} from "@/stores/offline-store";

type Tone = "online" | "offline" | "pending" | "syncing";

const toneStyles: Record<Tone, { container: string; text: string }> = {
  online: {
    container: "bg-risk-green/10 border-risk-green",
    text: "text-risk-green",
  },
  offline: {
    container: "bg-risk-red/10 border-risk-red",
    text: "text-risk-red",
  },
  pending: {
    container: "bg-risk-yellow/10 border-risk-yellow",
    text: "text-risk-yellow",
  },
  syncing: {
    container: "bg-primary-100 border-primary-500",
    text: "text-primary-700",
  },
};

export interface OfflineIndicatorProps {
  /**
   * Hide the badge entirely while everything is healthy. Useful in
   * dense headers where we only want a signal when something is off.
   */
  hideWhenIdle?: boolean;
}

export function OfflineIndicator({
  hideWhenIdle = false,
}: OfflineIndicatorProps): React.ReactElement | null {
  const { t } = useTranslation();
  const isOffline = useOfflineStore(selectIsOffline);
  const pendingCount = useOfflineStore(selectPendingCount);
  const deadCount = useOfflineStore(selectDeadCount);
  const isFlushing = useOfflineStore((state) => state.isFlushing);

  const { tone, label } = useMemo<{ tone: Tone; label: string }>(() => {
    if (isFlushing) {
      return { tone: "syncing", label: t("offline.syncing") };
    }
    if (isOffline) {
      return { tone: "offline", label: t("offline.offline") };
    }
    if (pendingCount > 0) {
      return {
        tone: "pending",
        label: t("offline.pending", { count: pendingCount }),
      };
    }
    if (deadCount > 0) {
      return {
        tone: "pending",
        label: t("offline.deadLetter", { count: deadCount }),
      };
    }
    return { tone: "online", label: t("offline.online") };
  }, [deadCount, isFlushing, isOffline, pendingCount, t]);

  const isIdleHealthy =
    !isOffline && !isFlushing && pendingCount === 0 && deadCount === 0;
  if (hideWhenIdle && isIdleHealthy) {
    return null;
  }

  const style = toneStyles[tone];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      className={`flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1 ${style.container}`}
    >
      {tone === "syncing" ? (
        <ActivityIndicator size="small" color="#1d4ed8" />
      ) : (
        <View
          className={`h-1.5 w-1.5 rounded-full ${
            tone === "online"
              ? "bg-risk-green"
              : tone === "offline"
                ? "bg-risk-red"
                : "bg-risk-yellow"
          }`}
        />
      )}
      <Text className={`text-xs font-semibold ${style.text}`}>{label}</Text>
    </View>
  );
}
