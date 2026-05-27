/**
 * Component tests for the <Card /> surface.
 *
 * Card is a presentational wrapper around <View>. We assert that
 * children are rendered, props pass through, and the variant/padding
 * combinations produce a className string that contains the
 * canonical tokens — without locking the test to the exact ordering.
 */

import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, View } from "react-native";

import { Card } from "@/components/ui/Card";

function rootView(tree: TestRenderer.ReactTestRenderer): TestRenderer.ReactTestInstance {
  return tree.root.findByType(View);
}

describe("<Card />", () => {
  it("renders children inside a single <View />", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        <Card>
          <Text>hello</Text>
        </Card>,
      );
    });
    const texts = tree!.root.findAllByType(Text);
    expect(texts).toHaveLength(1);
    expect(texts[0]!.props.children).toBe("hello");
  });

  it("applies the default variant + medium padding", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(<Card><Text>x</Text></Card>);
    });
    const view = rootView(tree!);
    const className: string = view.props.className ?? "";
    expect(className).toContain("bg-white");
    expect(className).toContain("p-4");
    expect(className).toContain("rounded-2xl");
  });

  it("supports the elevated variant with shadow class", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        <Card variant="elevated" padding="lg"><Text>x</Text></Card>,
      );
    });
    const className: string = rootView(tree!).props.className ?? "";
    expect(className).toContain("shadow-md");
    expect(className).toContain("p-6");
  });

  it("supports the outline variant with border class", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        <Card variant="outline" padding="none"><Text>x</Text></Card>,
      );
    });
    const className: string = rootView(tree!).props.className ?? "";
    expect(className).toContain("border");
    // padding="none" → no p-* token in the composed string
    expect(className).not.toMatch(/\bp-\d/);
  });

  it("appends a caller-provided className", () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        <Card className="my-extra-class"><Text>x</Text></Card>,
      );
    });
    const className: string = rootView(tree!).props.className ?? "";
    expect(className).toContain("my-extra-class");
  });
});
