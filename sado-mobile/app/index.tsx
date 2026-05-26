import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Initial landing screen for the SADO mobile app.
 *
 * This is the M3 scaffold home — it proves the Expo Router + NativeWind +
 * SafeAreaView pipeline compiles and renders. It will be replaced in M14
 * by the onboarding/auth gate once authentication is in place.
 */
export default function HomeScreen(): React.ReactElement {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        className="flex-1 px-6"
      >
        <View className="flex-1 justify-center gap-8 py-10">
          <View className="gap-3">
            <Text className="text-4xl font-bold text-primary-700">SADO</Text>
            <Text className="text-base text-neutral-600">
              AI-powered speech therapy for children — Uzbekistan
            </Text>
          </View>

          <View className="gap-4">
            <FeatureCard
              title="Gamified assessment"
              description="10–15 minute interactive games detect speech disorders early."
              accent="green"
            />
            <FeatureCard
              title="Personalized exercises"
              description="Daily 5–10 minute practice tailored to each child's needs."
              accent="yellow"
            />
            <FeatureCard
              title="Therapist support"
              description="Connect parents, teachers, and speech therapists in one place."
              accent="red"
            />
          </View>

          <Pressable
            className="mt-4 items-center rounded-2xl bg-primary-600 px-6 py-4 active:bg-primary-700"
            accessibilityRole="button"
            accessibilityLabel="Get started"
          >
            <Text className="text-base font-semibold text-white">
              Get started
            </Text>
          </Pressable>

          <Text className="text-center text-xs uppercase tracking-wider text-neutral-400">
            Build status: scaffolding complete · auth & onboarding next
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type Accent = "green" | "yellow" | "red";

const accentClass: Record<Accent, string> = {
  green: "border-risk-green/40 bg-risk-green/5",
  yellow: "border-risk-yellow/40 bg-risk-yellow/5",
  red: "border-risk-red/40 bg-risk-red/5",
};

function FeatureCard({
  title,
  description,
  accent,
}: {
  title: string;
  description: string;
  accent: Accent;
}): React.ReactElement {
  return (
    <View
      className={`rounded-2xl border p-4 ${accentClass[accent]}`}
      accessible
      accessibilityRole="summary"
    >
      <Text className="text-base font-semibold text-neutral-900">{title}</Text>
      <Text className="mt-1 text-sm text-neutral-600">{description}</Text>
    </View>
  );
}
