/**
 * Component tests for the shared `SearchInput`. The component's whole
 * purpose is to debounce keystrokes before propagating them upward,
 * so we drive it with `fireEvent` and use real timers + a polling
 * `waitFor` to assert that `onChange` only fires after the configured
 * delay elapses.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => (key === "common.search" ? "Search" : key),
    i18n: { language: "uz", changeLanguage: () => Promise.resolve() },
  }),
}));

import { SearchInput } from "@/components/shared/search-input";

describe("SearchInput", () => {
  it("renders an input with the placeholder + accessible name", () => {
    render(<SearchInput value="" onChange={() => undefined} />);
    const input = screen.getByRole("searchbox", { name: "Search" });
    expect(input).toHaveAttribute("placeholder", "Search");
  });

  it("does not propagate immediately on the first keystroke", () => {
    const onChange = vi.fn();
    render(
      <SearchInput value="" onChange={onChange} debounceMs={250} />,
    );
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "a" } });
    // Synchronous assertion: the debounce must not have fired yet.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("propagates the latest value after the debounce delay", async () => {
    const onChange = vi.fn();
    render(
      <SearchInput value="" onChange={onChange} debounceMs={50} />,
    );
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "alic" } });
    await waitFor(
      () => {
        expect(onChange).toHaveBeenCalledWith("alic");
      },
      { timeout: 1000 },
    );
  });

  it("respects an externally controlled value reset", () => {
    const { rerender } = render(
      <SearchInput value="initial" onChange={() => undefined} />,
    );
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    expect(input.value).toBe("initial");
    rerender(<SearchInput value="" onChange={() => undefined} />);
    expect(input.value).toBe("");
  });
});
