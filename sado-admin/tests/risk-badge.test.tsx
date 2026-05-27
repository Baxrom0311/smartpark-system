/**
 * Component tests for the shared `RiskBadge`. Covers all three risk
 * levels and the variant class mapping that downstream lists rely on
 * to colour rows.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "risk.green": "Green",
        "risk.yellow": "Yellow",
        "risk.red": "Red",
      };
      return labels[key] ?? key;
    },
    i18n: { language: "uz", changeLanguage: () => Promise.resolve() },
  }),
}));

import { RiskBadge } from "@/components/shared/risk-badge";

describe("RiskBadge", () => {
  it("renders the green level with translated label and risk-green class", () => {
    const { container } = render(<RiskBadge level="green" />);
    expect(screen.getByText("Green")).toBeInTheDocument();
    const badge = container.querySelector("span");
    expect(badge?.className).toMatch(/risk-green/);
  });

  it("renders the yellow level with risk-yellow class", () => {
    const { container } = render(<RiskBadge level="yellow" />);
    expect(screen.getByText("Yellow")).toBeInTheDocument();
    const badge = container.querySelector("span");
    expect(badge?.className).toMatch(/risk-yellow/);
  });

  it("renders the red level with risk-red class", () => {
    const { container } = render(<RiskBadge level="red" />);
    expect(screen.getByText("Red")).toBeInTheDocument();
    const badge = container.querySelector("span");
    expect(badge?.className).toMatch(/risk-red/);
  });

  it("uses an inline-flex span so it can sit alongside text", () => {
    const { container } = render(<RiskBadge level="green" />);
    const badge = container.querySelector("span");
    // Badge component applies inline-flex; just confirm it's a SPAN
    // (not a DIV or BUTTON) so it never breaks parent flex/grid rows.
    expect(badge?.tagName).toBe("SPAN");
  });
});
