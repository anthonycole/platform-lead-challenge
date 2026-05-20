import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import ShopifyOrderCard from "./ShopifyOrderCard";
import { makeShopifyEvent } from "../__test-utils__/fixtures";

describe("ShopifyOrderCard", () => {
  it("renders order id and price from the payload", () => {
    render(
      <ShopifyOrderCard
        event={makeShopifyEvent({
          payload: { id: "1234", total_price: "42.00", line_items: [] },
        })}
      />,
    );
    expect(screen.getByText(/Order 1234/)).toBeInTheDocument();
    expect(screen.getByText(/\$42\.00/)).toBeInTheDocument();
  });

  it("falls back to externalId when payload has no id", () => {
    render(
      <ShopifyOrderCard
        event={makeShopifyEvent({
          externalId: "ext_999",
          payload: { line_items: [] },
        })}
      />,
    );
    expect(screen.getByText(/Order ext_999/)).toBeInTheDocument();
  });

  it("renders each line item with title and quantity", () => {
    render(<ShopifyOrderCard event={makeShopifyEvent()} />);
    expect(screen.getByText("Cold Brew × 2")).toBeInTheDocument();
    expect(screen.getByText("Croissant × 1")).toBeInTheDocument();
  });

  it("shows an empty-items message when line_items is missing", () => {
    render(
      <ShopifyOrderCard
        event={makeShopifyEvent({
          payload: { id: "1", total_price: "10.00" },
        })}
      />,
    );
    expect(screen.getByText("No line items recorded.")).toBeInTheDocument();
  });

  it("tolerates a null payload", () => {
    render(<ShopifyOrderCard event={makeShopifyEvent({ payload: null })} />);
    expect(screen.getByText(/Order shop_order_1001/)).toBeInTheDocument();
    expect(screen.getByText("No line items recorded.")).toBeInTheDocument();
  });

  it("renders the Shopify source badge", () => {
    render(<ShopifyOrderCard event={makeShopifyEvent()} />);
    expect(screen.getByText("Shopify")).toBeInTheDocument();
    expect(screen.getByText(/order\.created/)).toBeInTheDocument();
  });
});
