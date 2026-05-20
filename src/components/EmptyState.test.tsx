import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("renders the prompt to search", () => {
    render(<EmptyState />);
    expect(
      screen.getByRole("heading", { name: "Search for a customer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Shopify customer ID, or Mindbody client ID/),
    ).toBeInTheDocument();
  });
});
