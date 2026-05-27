/**
 * Component tests for the shared `StatCard`. Verifies the four user-
 * visible states the dashboard relies on: regular value, loading
 * skeleton, positive trend (green), and negative trend (red).
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Activity } from "lucide-react";

import { StatCard } from "@/components/shared/stat-card";

describe("StatCard", () => {
  it("renders the label and value", () => {
    render(<StatCard label="Total children" value={1234} />);
    expect(screen.getByText("Total children")).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
  });

  it("hides the value and shows a skeleton while loading", () => {
    const { container } = render(
      <StatCard label="Loading" value={42} loading />,
    );
    expect(screen.queryByText("42")).not.toBeInTheDocument();
    // The shared <Skeleton /> component renders with a `animate-pulse`
    // utility class — easy structural check.
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("formats a positive trend with a leading +", () => {
    render(
      <StatCard label="Assessments" value={50} trend={{ value: 12 }} />,
    );
    expect(screen.getByText(/\+12%/)).toBeInTheDocument();
  });

  it("uses the danger color for negative trends", () => {
    const { container } = render(
      <StatCard label="Drop" value={10} trend={{ value: -5 }} />,
    );
    const trend = container.querySelector(".text-risk-red");
    expect(trend).not.toBeNull();
    expect(trend?.textContent).toMatch(/-5%/);
  });

  it("renders the icon when one is supplied", () => {
    const { container } = render(
      <StatCard label="With icon" value={1} icon={Activity} />,
    );
    // Lucide icons render as <svg>; aria-hidden on the wrapper.
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });
});
