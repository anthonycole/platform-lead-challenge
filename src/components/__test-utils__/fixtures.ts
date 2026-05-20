import type { CustomerView } from "@/lib/timeline";

export function makeShopifyEvent(
  overrides: Partial<CustomerView["events"][number]> = {},
): CustomerView["events"][number] {
  return {
    id: "evt_shop_1",
    source: "shopify",
    externalId: "shop_order_1001",
    eventType: "order.created",
    occurredAt: new Date("2026-05-01T10:15:00Z"),
    receivedAt: new Date("2026-05-01T10:15:01Z"),
    payload: {
      id: "1001",
      total_price: "89.00",
      line_items: [
        { title: "Cold Brew", quantity: 2 },
        { title: "Croissant", quantity: 1 },
      ],
    },
    ...overrides,
  };
}

export function makeMindbodyEvent(
  overrides: Partial<CustomerView["events"][number]> = {},
): CustomerView["events"][number] {
  return {
    id: "evt_mb_1",
    source: "mindbody",
    externalId: "mb_booking_77",
    eventType: "booking.created",
    occurredAt: new Date("2026-05-10T18:00:00Z"),
    receivedAt: new Date("2026-05-10T18:00:01Z"),
    payload: {
      id: "77",
      class_name: "Reformer Pilates",
      studio: "Bondi",
      scheduled_at: "2026-05-12T07:00:00+10:00",
    },
    ...overrides,
  };
}

export function makeCustomer(
  overrides: Partial<CustomerView["customer"]> = {},
): CustomerView["customer"] {
  return {
    id: "cus_01H8ABCDEF",
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-05-01T00:00:00Z"),
    ...overrides,
  };
}

export function makeSignal(
  overrides: Partial<CustomerView["signals"][number]> = {},
): CustomerView["signals"][number] {
  return {
    type: "email",
    value: "jane@example.com",
    confidence: "deterministic",
    firstSeenAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-05-01T00:00:00Z"),
    ...overrides,
  };
}
