/**
 * Recording game screen — sequences the child through one prompt at a
 * time, capturing audio for each task and uploading it to the API.
 *
 * Flow per step:
 *   1. Show prompt + microphone button
 *   2. Child taps to record (max 60s, auto-stops)
 *   3. After stop, parent can preview, retry, or submit
 *   4. On submit we POST the recording — on success advance one step
 *   5. After the last step, navigate to results
 *
 * The store keeps track of the current step so users can re-enter the
 * screen from a deep-link without losing progress.
 */

import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { AudioPlayer } from "@/components/audio/AudioPlayer";
import { AudioRecorder } from "@/components/audio/AudioRecorder";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/game/ProgressBar";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { ApiError } from "@/services/api";
import {
  MAX_DURATION_SEC,
  MIN_DURATION_SEC,
  deleteFile,
} from "@/services/audio";
import { uploadRecording } from "@/services/assessments";
import { useAssessmentStore } from "@/stores/assessment-store";

export default function AssessmentGameScreen(): React.ReactElement {
  const { t } = useTranslation();

  const assessment = useAssessmentStore((state) => state.assessment);
  const step = useAssessmentStore((state) => state.step);
  const totalSteps = useAssessmentStore((state) => state.totalSteps);
  const prompts = useAssessmentStore((state) => state.prompts);
  const goToStep = useAssessmentStore((state) => state.goToStep);
  const appendRecording = useAssessmentStore((state) => state.appendRecording);

  const recorder = useAudioRecorder(MAX_DURATION_SEC);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currentPrompt = useMemo(() => prompts[step] ?? null, [prompts, step]);

  if (assessment == null || currentPrompt == null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  const handleSubmit = async (): Promise<void> => {
    if (!recorder.result) return;
    if (recorder.durationSec < MIN_DURATION_SEC) {
      Alert.alert(t("assessment.tooShort"));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const uploaded = await uploadRecording({
        assessmentId: assessment.id,
        fileUri: recorder.result.uri,
        contentType: recorder.result.contentType,
        durationSec: recorder.result.durationSec,
        taskType: currentPrompt.taskType,
        prompt: currentPrompt.prompt,
      });
      appendRecording(uploaded);
      // Best-effort: clean up the local file once the server has it.
      void deleteFile(recorder.result.uri);
      recorder.reset();

      const next = step + 1;
      if (next >= totalSteps) {
        router.replace("/(parent)/assessment/results");
      } else {
        goToStep(next);
      }
    } catch (error) {
      if (error instanceof ApiError) setSubmitError(error.message);
      else if (error instanceof Error) setSubmitError(error.message);
      else setSubmitError(t("assessment.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const showPlayback = recorder.status === "finished" && recorder.result != null;
  const permissionDenied =
    recorder.status === "error" && recorder.error === "permission_denied";

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
        <View className="gap-4">
          <ProgressBar
            current={step + 1}
            total={totalSteps}
            label={t("assessment.step", {
              current: step + 1,
              total: totalSteps,
            })}
          />

          <Card variant="elevated" padding="lg">
            <Text className="text-sm font-medium text-neutral-500">
              {t("assessment.prompt")}
            </Text>
            <Text className="mt-2 text-3xl font-bold text-primary-700">
              {currentPrompt.prompt}
            </Text>
          </Card>
        </View>

        <View className="mt-8 items-center">
          <AudioRecorder
            status={recorder.status}
            durationSec={recorder.durationSec}
            level={recorder.level}
            maxSeconds={MAX_DURATION_SEC}
            onStart={() => {
              void recorder.start();
            }}
            onStop={() => {
              void recorder.stop();
            }}
            onReset={recorder.reset}
            labels={{
              tapToRecord: t("assessment.tapToRecord"),
              recording: t("assessment.recording"),
              stop: t("assessment.stop"),
              retry: t("common.retry"),
              permissionDenied: t("assessment.permissionDenied"),
            }}
          />
        </View>

        {permissionDenied ? (
          <View className="mt-4">
            <Text className="text-sm text-risk-red">
              {t("assessment.permissionDeniedBody")}
            </Text>
          </View>
        ) : null}

        {showPlayback && recorder.result != null ? (
          <View className="mt-6 gap-3">
            <AudioPlayer
              uri={recorder.result.uri}
              durationSec={recorder.result.durationSec}
              label={t("assessment.playback")}
            />
            <View className="flex-row gap-3">
              <Button
                label={t("common.retry")}
                variant="outline"
                fullWidth
                onPress={recorder.reset}
              />
              <Button
                label={submitting ? t("assessment.submitting") : t("assessment.submit")}
                loading={submitting}
                fullWidth
                onPress={() => {
                  void handleSubmit();
                }}
              />
            </View>
          </View>
        ) : null}

        {submitError != null ? (
          <Text className="mt-4 text-sm text-risk-red">{submitError}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
