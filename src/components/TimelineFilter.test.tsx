import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
let currentSearchParams = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(currentSearchParams),
}));

import TimelineFilter from "./TimelineFilter";

describe("TimelineFilter", () => {
  beforeEach(() => {
    pushMock.mockReset();
    currentSearchParams = "";
  });

  it("renders the three filter tabs", () => {
    render(<TimelineFilter active="all" />);
    expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Orders" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Bookings" })).toBeInTheDocument();
  });

  it("marks the active tab as selected", () => {
    render(<TimelineFilter active="orders" />);
    expect(screen.getByRole("tab", { name: "Orders" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("sets ?filter=orders when Orders is clicked", async () => {
    const user = userEvent.setup();
    render(<TimelineFilter active="all" />);
    await user.click(screen.getByRole("tab", { name: "Orders" }));
    expect(pushMock).toHaveBeenCalledWith("/?filter=orders");
  });

  it("removes the filter param when All is clicked", async () => {
    currentSearchParams = "q=jane&filter=bookings";
    const user = userEvent.setup();
    render(<TimelineFilter active="bookings" />);
    await user.click(screen.getByRole("tab", { name: "All" }));
    expect(pushMock).toHaveBeenCalledWith("/?q=jane");
  });

  it("preserves the q param across filter changes", async () => {
    currentSearchParams = "q=jane%40example.com";
    const user = userEvent.setup();
    render(<TimelineFilter active="all" />);
    await user.click(screen.getByRole("tab", { name: "Bookings" }));
    expect(pushMock).toHaveBeenCalledWith(
      "/?q=jane%40example.com&filter=bookings",
    );
  });
});
