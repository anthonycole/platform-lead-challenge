import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import Timeline from "./Timeline";
import { makeShopifyEvent, makeMindbodyEvent } from "./__test-utils__/fixtures";

describe("Timeline", () => {
  it("shows an empty message when nothing matches the filter", () => {
    render(<Timeline events={[makeShopifyEvent()]} filter="bookings" />);
    expect(screen.getByText("No events match this filter.")).toBeInTheDocument();
    expect(screen.getByText(/Activity timeline \(0 of 1\)/)).toBeInTheDocument();
  });

  it("renders every event when filter is 'all'", () => {
    render(
      <Timeline
        events={[makeShopifyEvent(), makeMindbodyEvent()]}
        filter="all"
      />,
    );
    expect(screen.getByText(/Activity timeline \(2 of 2\)/)).toBeInTheDocument();
    expect(screen.getByText("Shopify")).toBeInTheDocument();
    expect(screen.getByText("Mindbody")).toBeInTheDocument();
  });

  it("only renders shopify events when filter is 'orders'", () => {
    render(
      <Timeline
        events={[makeShopifyEvent(), makeMindbodyEvent()]}
        filter="orders"
      />,
    );
    expect(screen.getByText(/Activity timeline \(1 of 2\)/)).toBeInTheDocument();
    expect(screen.getByText("Shopify")).toBeInTheDocument();
    expect(screen.queryByText("Mindbody")).not.toBeInTheDocument();
  });

  it("only renders mindbody events when filter is 'bookings'", () => {
    render(
      <Timeline
        events={[makeShopifyEvent(), makeMindbodyEvent()]}
        filter="bookings"
      />,
    );
    expect(screen.getByText(/Activity timeline \(1 of 2\)/)).toBeInTheDocument();
    expect(screen.getByText("Mindbody")).toBeInTheDocument();
    expect(screen.queryByText("Shopify")).not.toBeInTheDocument();
  });

  it("ignores events from unknown sources", () => {
    const events = [
      makeShopifyEvent(),
      makeShopifyEvent({ id: "weird", source: "intercom", externalId: "x" }),
    ];
    render(<Timeline events={events} filter="all" />);
    expect(screen.getByText(/Activity timeline \(2 of 2\)/)).toBeInTheDocument();
    expect(screen.getAllByText("Shopify")).toHaveLength(1);
  });
});
