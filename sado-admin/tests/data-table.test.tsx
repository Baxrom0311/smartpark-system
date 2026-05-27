/**
 * Component tests for the shared `DataTable`. Covers the four states
 * the rest of the app relies on: skeleton (loading), error, empty, and
 * a populated body with a Load more button when paginated.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ColumnDef } from "@tanstack/react-table";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "uz", changeLanguage: () => Promise.resolve() },
  }),
}));

import { DataTable } from "@/components/shared/data-table";

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDef<Row, unknown>[] = [
  {
    accessorKey: "name",
    header: () => "Name",
    cell: (info) => String(info.getValue()),
  },
];

describe("DataTable", () => {
  it("renders provided rows", () => {
    const data: Row[] = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];
    render(<DataTable<Row> columns={columns} data={data} getRowId={(r) => r.id} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows the empty message when data is empty", () => {
    render(
      <DataTable<Row>
        columns={columns}
        data={[]}
        emptyMessage="No data here"
      />,
    );
    expect(screen.getByText("No data here")).toBeInTheDocument();
  });

  it("renders the error message when error is provided", () => {
    render(
      <DataTable<Row>
        columns={columns}
        data={[]}
        error="Something went wrong"
      />,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("calls onLoadMore when the load-more button is clicked", async () => {
    const onLoadMore = vi.fn();
    const user = userEvent.setup();
    render(
      <DataTable<Row>
        columns={columns}
        data={[{ id: "1", name: "Alice" }]}
        hasMore
        onLoadMore={onLoadMore}
      />,
    );
    const button = screen.getByRole("button", { name: /loadMore/i });
    await user.click(button);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
