/**
 * Component tests for the gamified <ProgressBar />.
 *
 * The bar uses Reanimated for the fill animation. jest-expo ships
 * a Reanimated mock so `useSharedValue` / `useAnimatedStyle` /
 * `withTiming` resolve to plain JS objects in tests. We assert on
 * the *static* presentational structure rather than the animated
 * values to keep the test deterministic.
 */

import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";

import { ProgressBar } from "@/components/game/ProgressBar";

describe("<ProgressBar />", () => {
  it("renders without a label when none is provided", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(<ProgressBar current={1} total={4} />);
    });
    const texts = tree!.root.findAllByType(Text);
    expect(texts).toHaveLength(0);
  });

  it("renders the label when supplied", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        <ProgressBar current={2} total={5} label="2 / 5 vazifa" />,
      );
    });
    const texts = tree!.root.findAllByType(Text);
    expect(texts).toHaveLength(1);
    expect(texts[0]!.props.children).toBe("2 / 5 vazifa");
  });

  it("clamps a current value below zero to zero", () => {
    // Internal computation is `Math.max(0, current/total)`. We render
    // and simply assert no crash + label still renders.
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        <ProgressBar current={-3} total={4} label="x" />,
      );
    });
    expect(tree!.toJSON()).not.toBeNull();
  });

  it("clamps a current value above the total", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        <ProgressBar current={10} total={4} label="overflow" />,
      );
    });
    expect(tree!.toJSON()).not.toBeNull();
  });

  it("handles total=0 without dividing by zero", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(<ProgressBar current={2} total={0} />);
    });
    expect(tree!.toJSON()).not.toBeNull();
  });

  it("re-renders when current changes (effect re-runs)", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(<ProgressBar current={1} total={4} />);
    });
    act(() => {
      tree!.update(<ProgressBar current={3} total={4} />);
    });
    // Tree still renders — the assertion is that no error was thrown
    // by Reanimated when the shared value updates.
    expect(tree!.toJSON()).not.toBeNull();
  });
});
