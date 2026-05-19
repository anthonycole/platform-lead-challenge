import { describe, it, expect } from "vitest";
import {
  computeCustomerMetrics,
  formatCurrencyAUD,
  formatRelativeTime,
} from "./metrics";
import type { CustomerView } from "./timeline";

type Event = CustomerView["events"][number];

function shopifyEvent(occurredAt: string, total_price: string | undefined): Event {
  return {
    id: `evt_${occurredAt}`,
    source: "shopify",
    externalId: `shopify_${occurredAt}`,
    eventType: "order.created",
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(occurredAt),
    payload: total_price ? { total_price } : {},
  };
}

function mindbodyEvent(occurredAt: string): Event {
  return {
    id: `evt_${occurredAt}`,
    source: "mindbody",
    externalId: `mb_${occurredAt}`,
    eventType: "booking.created",
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(occurredAt),
    payload: {},
  };
}

describe("computeCustomerMetrics", () => {
  it("returns zeros for an empty event list", () => {
    expect(computeCustomerMetrics([])).toEqual({
      orderCount: 0,
      bookingCount: 0,
      lifetimeSpendCents: 0,
      lastActivityAt: null,
    });
  });

  it("sums Shopify totals as cents, counts orders and bookings separately", () => {
    const events: Event[] = [
      shopifyEvent("2026-04-01T10:00:00Z", "89.00"),
      shopifyEvent("2026-04-10T10:00:00Z", "34.50"),
      mindbodyEvent("2026-04-05T10:00:00Z"),
    ];
    const m = computeCustomerMetrics(events);
    expect(m.orderCount).toBe(2);
    expect(m.bookingCount).toBe(1);
    expect(m.lifetimeSpendCents).toBe(12350);
  });

  it("ignores missing or non-numeric total_price values", () => {
    const events: Event[] = [
      shopifyEvent("2026-04-01T10:00:00Z", undefined),
      shopifyEvent("2026-04-02T10:00:00Z", "not-a-number"),
      shopifyEvent("2026-04-03T10:00:00Z", "12.34"),
    ];
    const m = computeCustomerMetrics(events);
    expect(m.orderCount).toBe(3);
    expect(m.lifetimeSpendCents).toBe(1234);
  });

  it("returns the most recent occurredAt as lastActivityAt regardless of input order", () => {
    const events: Event[] = [
      shopifyEvent("2026-04-01T10:00:00Z", "10.00"),
      mindbodyEvent("2026-04-20T10:00:00Z"),
      shopifyEvent("2026-04-10T10:00:00Z", "20.00"),
    ];
    expect(computeCustomerMetrics(events).lastActivityAt).toEqual(
      new Date("2026-04-20T10:00:00Z"),
    );
  });
});

describe("formatCurrencyAUD", () => {
  it("formats cents as AUD with no fractional digits", () => {
    expect(formatCurrencyAUD(12350)).toBe("$124");
    expect(formatCurrencyAUD(0)).toBe("$0");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-05-19T12:00:00Z");

  it("returns 'just now' for sub-minute deltas", () => {
    expect(formatRelativeTime(new Date("2026-05-19T11:59:30Z"), now)).toBe("just now");
  });
  it("uses minutes, hours, days for < 30 day deltas", () => {
    expect(formatRelativeTime(new Date("2026-05-19T11:45:00Z"), now)).toBe("15m ago");
    expect(formatRelativeTime(new Date("2026-05-19T09:00:00Z"), now)).toBe("3h ago");
    expect(formatRelativeTime(new Date("2026-05-17T12:00:00Z"), now)).toBe("2d ago");
  });
  it("falls back to absolute date past 30 days", () => {
    const result = formatRelativeTime(new Date("2026-03-01T12:00:00Z"), now);
    expect(result).toMatch(/Mar|March/);
  });
});
