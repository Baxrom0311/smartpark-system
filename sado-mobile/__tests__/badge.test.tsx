/**
 * Component tests for the risk-aware <Badge /> pill.
 *
 * The Badge encodes the green/yellow/red risk tone and is the
 * primary visual cue throughout the parent dashboard. We verify
 * label rendering, tone class mapping, and size variants.
 */

import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, View } from "react-native";

import { Badge } from "@/components/ui/Badge";

function rootView(tree: TestRenderer.ReactTestRenderer): TestRenderer.ReactTestInstance {
  const all = tree.root.findAllByType(View);
  if (all.length === 0) {
    throw new Error("expected at least one <View />");
  }
  return all[0]!;
}

function rootText(tree: TestRenderer.ReactTestRenderer): TestRenderer.ReactTestInstance {
  return tree.root.findByType(Text);
}

describe("<Badge />", () => {
  it("renders the supplied label", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(<Badge label="Yangi" />);
    });
    expect(rootText(tree!).props.children).toBe("Yangi");
  });

  it("uses the neutral tone by default", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(<Badge label="x" />);
    });
    const containerClass: string = rootView(tree!).props.className ?? "";
    const textClass: string = rootText(tree!).props.className ?? "";
    expect(containerClass).toContain("bg-neutral-100");
    expect(textClass).toContain("text-neutral-700");
  });

  it("maps risk tones (green/yellow/red) to the right token classes", () => {
    const tones: Array<{ tone: "green" | "yellow" | "red"; bg: string; fg: string }> = [
      { tone: "green", bg: "bg-risk-green/15", fg: "text-risk-green" },
      { tone: "yellow", bg: "bg-risk-yellow/15", fg: "text-risk-yellow" },
      { tone: "red", bg: "bg-risk-red/15", fg: "text-risk-red" },
    ];
    for (const { tone, bg, fg } of tones) {
      let tree: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        tree = TestRenderer.create(<Badge tone={tone} label={tone} />);
      });
      const containerClass: string = rootView(tree!).props.className ?? "";
      const textClass: string = rootText(tree!).props.className ?? "";
      expect(containerClass).toContain(bg);
      expect(textClass).toContain(fg);
    }
  });

  it("uses small padding/text by default and grows with size=md", () => {
    let small: TestRenderer.ReactTestRenderer | undefined;
    let medium: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      small = TestRenderer.create(<Badge label="x" size="sm" />);
      medium = TestRenderer.create(<Badge label="x" size="md" />);
    });
    const smallContainer: string = rootView(small!).props.className ?? "";
    const mediumContainer: string = rootView(medium!).props.className ?? "";
    const smallText: string = rootText(small!).props.className ?? "";
    const mediumText: string = rootText(medium!).props.className ?? "";
    expect(smallContainer).toContain("px-2");
    expect(mediumContainer).toContain("px-3");
    expect(smallText).toContain("text-xs");
    expect(mediumText).toContain("text-sm");
  });
});
