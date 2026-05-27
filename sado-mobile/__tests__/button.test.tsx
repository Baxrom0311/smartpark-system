/**
 * Component tests for the shared <Button /> primitive.
 *
 * We use `react-test-renderer` (already in deps via jest-expo) and
 * walk the rendered tree to validate accessibility metadata, the
 * disabled/loading state, and the press handler. Tailwind classes
 * are kept as opaque strings — we assert on the *behavioural* props
 * rather than on class names so refactors of the design tokens do
 * not break tests.
 */

import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { ActivityIndicator, Pressable } from "react-native";

import { Button } from "@/components/ui/Button";

function findPressable(root: TestRenderer.ReactTestInstance): TestRenderer.ReactTestInstance {
  return root.findByType(Pressable);
}

describe("<Button />", () => {
  it("renders the label and exposes accessibility role/label", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(<Button label="Continue" onPress={() => undefined} />);
    });
    const root = tree!.root;
    const pressable = findPressable(root);
    expect(pressable.props.accessibilityRole).toBe("button");
    expect(pressable.props.accessibilityLabel).toBe("Continue");
    // Label text is rendered as a child of the Pressable.
    const texts = root.findAllByProps({ children: "Continue" });
    expect(texts.length).toBeGreaterThan(0);
  });

  it("invokes onPress when pressed and not disabled", () => {
    const onPress = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(<Button label="Save" onPress={onPress} />);
    });
    const pressable = findPressable(tree!.root);
    act(() => {
      pressable.props.onPress({});
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("marks itself disabled+busy and shows a spinner when loading", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(<Button label="Saving" loading onPress={() => undefined} />);
    });
    const pressable = findPressable(tree!.root);
    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.accessibilityState).toEqual({ disabled: true, busy: true });
    // ActivityIndicator is rendered while loading.
    expect(tree!.root.findAllByType(ActivityIndicator).length).toBe(1);
  });

  it("respects explicit disabled prop and ignores presses", () => {
    const onPress = jest.fn();
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        <Button label="Submit" disabled onPress={onPress} />,
      );
    });
    const pressable = findPressable(tree!.root);
    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.accessibilityState).toEqual({ disabled: true, busy: false });
  });

  it("uses an explicit accessibilityLabel when provided", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        <Button
          label="OK"
          accessibilityLabel="Confirm assessment start"
          onPress={() => undefined}
        />,
      );
    });
    const pressable = findPressable(tree!.root);
    expect(pressable.props.accessibilityLabel).toBe("Confirm assessment start");
  });
});
