/**
 * Component tests for the global `ErrorFallback`. The route root
 * mounts this whenever an uncaught error escapes a loader or
 * component. We mock the TanStack Link (no router context in unit
 * tests) and i18n so we can focus on the rendering contract: title,
 * extracted message, retry button wiring, and graceful handling of
 * exotic error shapes.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "errors.boundaryTitle": "Something went wrong",
        "errors.boundaryDesc":
          "We couldn't load this page — try again or go home.",
        "errors.backHome": "Back home",
        "common.retry": "Retry",
      };
      return labels[key] ?? key;
    },
    i18n: { language: "uz", changeLanguage: () => Promise.resolve() },
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { ErrorFallback } from "@/components/shared/error-fallback";

describe("ErrorFallback", () => {
  it("renders the boundary title and description", () => {
    render(<ErrorFallback error={new Error("boom")} />);
    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "We couldn't load this page — try again or go home.",
      ),
    ).toBeInTheDocument();
  });

  it("extracts the message from a real Error instance", () => {
    render(<ErrorFallback error={new Error("network failure")} />);
    const detail = screen.getByLabelText("error-detail");
    expect(detail.textContent).toContain("network failure");
  });

  it("renders a retry button only when reset is provided", () => {
    const { rerender } = render(<ErrorFallback error={null} />);
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();

    const reset = vi.fn();
    rerender(<ErrorFallback error={null} reset={reset} />);
    expect(
      screen.getByRole("button", { name: "Retry" }),
    ).toBeInTheDocument();
  });

  it("calls reset when the retry button is clicked", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<ErrorFallback error={new Error("x")} reset={reset} />);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("falls back gracefully when error has no parseable message", () => {
    render(<ErrorFallback error={42} />);
    // Title still appears; no error-detail block since 42 has no message.
    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("error-detail")).toBeNull();
  });

  it("always offers a back-home link", () => {
    render(<ErrorFallback error={new Error("x")} />);
    const link = screen.getByRole("link", { name: "Back home" });
    expect(link).toHaveAttribute("href", "/");
  });
});
