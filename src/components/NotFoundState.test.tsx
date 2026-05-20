import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import NotFoundState from "./NotFoundState";

describe("NotFoundState", () => {
  it("embeds the searched query in the title", () => {
    render(<NotFoundState query="jane@example.com" />);
    expect(
      screen.getByText('No customer matches "jane@example.com"'),
    ).toBeInTheDocument();
  });

  it("suggests trying other identifier types", () => {
    render(<NotFoundState query="404" />);
    expect(
      screen.getByText(/email, phone, device ID, Shopify/),
    ).toBeInTheDocument();
  });
});
