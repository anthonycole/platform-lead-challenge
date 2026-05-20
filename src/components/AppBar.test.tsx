import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
}));

import AppBar from "./AppBar";

describe("AppBar", () => {
  it("renders the product heading", () => {
    render(<AppBar initialQuery="" />);
    expect(
      screen.getByRole("heading", { name: "KIC Customer Lookup" }),
    ).toBeInTheDocument();
  });

  it("embeds a SearchBar seeded with the initial query", () => {
    render(<AppBar initialQuery="jane@example.com" />);
    expect(
      screen.getByLabelText("Search any customer identifier"),
    ).toHaveValue("jane@example.com");
  });
});
