/**
 * Component tests for the shared `InfoRow`. The component is a tiny
 * label/value definition list row used on detail pages. We verify it
 * uses the correct semantic markup (`<dt>` + `<dd>`) so screen
 * readers can pair labels with values.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { InfoRow } from "@/components/shared/info-row";

describe("InfoRow", () => {
  it("renders the label inside a <dt> element", () => {
    const { container } = render(
      <InfoRow label="Email" value="ali@example.com" />,
    );
    const dt = container.querySelector("dt");
    expect(dt).not.toBeNull();
    expect(dt?.textContent).toBe("Email");
  });

  it("renders the value inside a <dd> element", () => {
    const { container } = render(
      <InfoRow label="Email" value="ali@example.com" />,
    );
    const dd = container.querySelector("dd");
    expect(dd).not.toBeNull();
    expect(dd?.textContent).toBe("ali@example.com");
  });

  it("supports rich react node values", () => {
    render(
      <InfoRow
        label="Status"
        value={<span data-testid="badge">Active</span>}
      />,
    );
    expect(screen.getByTestId("badge")).toBeInTheDocument();
  });

  it("merges custom className while keeping defaults", () => {
    const { container } = render(
      <InfoRow label="x" value="y" className="custom-row" />,
    );
    const row = container.firstElementChild;
    expect(row?.className).toContain("custom-row");
    // Always-on layout class:
    expect(row?.className).toMatch(/border-b/);
  });
});
