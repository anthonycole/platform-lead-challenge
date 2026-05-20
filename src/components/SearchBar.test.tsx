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

import SearchBar from "./SearchBar";

describe("SearchBar", () => {
  beforeEach(() => {
    pushMock.mockReset();
    currentSearchParams = "";
  });

  it("renders the initial query in the input", () => {
    render(<SearchBar initialQuery="jane@example.com" />);
    expect(
      screen.getByLabelText("Search any customer identifier"),
    ).toHaveValue("jane@example.com");
  });

  it("pushes a URL with the trimmed query on submit", async () => {
    const user = userEvent.setup();
    render(<SearchBar initialQuery="" />);

    const input = screen.getByLabelText("Search any customer identifier");
    await user.type(input, "  jane@example.com  ");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/?q=jane%40example.com");
  });

  it("removes q param when submitting an empty value", async () => {
    currentSearchParams = "q=existing&filter=orders";
    const user = userEvent.setup();
    render(<SearchBar initialQuery="existing" />);

    const input = screen.getByLabelText("Search any customer identifier");
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(pushMock).toHaveBeenCalledWith("/?filter=orders");
  });

  it("preserves existing query params when adding q", async () => {
    currentSearchParams = "filter=bookings";
    const user = userEvent.setup();
    render(<SearchBar initialQuery="" />);

    await user.type(
      screen.getByLabelText("Search any customer identifier"),
      "0412 345 678",
    );
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(pushMock).toHaveBeenCalledWith(
      "/?filter=bookings&q=0412+345+678",
    );
  });

  it("navigates to pathname only when no params remain", async () => {
    const user = userEvent.setup();
    render(<SearchBar initialQuery="" />);

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(pushMock).toHaveBeenCalledWith("/");
  });
});
