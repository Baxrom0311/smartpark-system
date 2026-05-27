/**
 * Component tests for the shared `PageHeader`. The header is used at
 * the top of every list/detail page; the contract is simple — render
 * a heading, optional description, and an optional right-aligned
 * actions slot.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PageHeader } from "@/components/shared/page-header";

describe("PageHeader", () => {
  it("renders the title as an h1 for assistive tech", () => {
    render(<PageHeader title="Children" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Children");
  });

  it("omits the description paragraph when none is provided", () => {
    const { container } = render(<PageHeader title="Plain" />);
    expect(container.querySelector("p")).toBeNull();
  });

  it("renders the description when supplied", () => {
    render(
      <PageHeader title="Children" description="Manage all children" />,
    );
    expect(screen.getByText("Manage all children")).toBeInTheDocument();
  });

  it("renders the actions slot when provided", () => {
    render(
      <PageHeader
        title="Users"
        actions={<button type="button">Invite</button>}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Invite" }),
    ).toBeInTheDocument();
  });
});
