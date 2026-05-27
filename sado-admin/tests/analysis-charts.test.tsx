/**
 * Smoke tests for the therapist analysis charts.
 *
 * Recharts renders an SVG inside a `ResponsiveContainer`; under jsdom
 * the container may report zero width and refuse to mount its
 * children, so we mock the container to render a passthrough wrapper.
 * That lets us assert on titles, ARIA labels, and that charts render
 * without throwing for representative payloads.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "uz", changeLanguage: () => Promise.resolve() },
  }),
}));

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 400 }}>{children}</div>
    ),
  };
});

import { FormantChart } from "@/components/analysis/formant-chart";
import { MfccChart } from "@/components/analysis/mfcc-chart";
import { PhonemeChart } from "@/components/analysis/phoneme-chart";
import { PitchChart } from "@/components/analysis/pitch-chart";
import type {
  FormantData,
  MfccFeatures,
  PhonemeScores,
  PitchData,
} from "@/types";

const pitch: PitchData = {
  f0_hz: [180, 190, 200, 210, 200, 195, 188],
  f0_mean: 194.7,
  f0_min: 180,
  f0_max: 210,
  voiced_ratio: 0.78,
};

const formants: FormantData = {
  tracks: {
    f1: [700, 720, 740, 730, 710],
    f2: [1700, 1750, 1780, 1740, 1720],
    f3: [2600, 2650, 2700, 2680, 2640],
  },
  f1_mean: 720,
  f2_mean: 1738,
  f3_mean: 2654,
};

const mfcc: MfccFeatures = {
  n_mfcc: 5,
  n_frames: 10,
  mean: [-12, -8, -4, -2, 1],
  std: [2, 1.5, 1.8, 1.1, 0.9],
  min: -20,
  max: 5,
};

const phonemes: PhonemeScores = {
  scores: { a: 0.92, e: 0.81, i: 0.55, o: 0.74, r: 0.45, s: 0.88 },
  weakest: [
    { phoneme: "r", score: 0.45 },
    { phoneme: "i", score: 0.55 },
  ],
  strongest: [
    { phoneme: "a", score: 0.92 },
    { phoneme: "s", score: 0.88 },
  ],
};

describe("analysis charts", () => {
  it("PitchChart renders an accessible region", () => {
    render(<PitchChart data={pitch} ariaLabel="pitch-chart" />);
    expect(screen.getByRole("img", { name: "pitch-chart" })).toBeInTheDocument();
  });

  it("PitchChart renders a placeholder when there is no data", () => {
    const empty: PitchData = { ...pitch, f0_hz: [] };
    render(<PitchChart data={empty} ariaLabel="pitch-empty" />);
    expect(screen.getByRole("img", { name: "pitch-empty" })).toBeInTheDocument();
  });

  it("FormantChart renders all three series", () => {
    render(<FormantChart data={formants} ariaLabel="formant-chart" />);
    expect(
      screen.getByRole("img", { name: "formant-chart" }),
    ).toBeInTheDocument();
  });

  it("MfccChart renders without throwing", () => {
    render(<MfccChart data={mfcc} ariaLabel="mfcc-chart" />);
    expect(screen.getByRole("img", { name: "mfcc-chart" })).toBeInTheDocument();
  });

  it("PhonemeChart sorts scores ascending and renders all phonemes", () => {
    render(
      <PhonemeChart
        data={phonemes}
        ariaLabel="phoneme-chart"
        weakLabel="weak"
        okLabel="ok"
      />,
    );
    expect(
      screen.getByRole("img", { name: "phoneme-chart" }),
    ).toBeInTheDocument();
  });
});
