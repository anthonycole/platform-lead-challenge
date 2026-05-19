/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from "vitest";

type CustomerRow = {
  id: string;
  status: string;
  mergedIntoId: string | null;
  createdAt: Date;
};
type SignalRow = {
  id: string;
  customerId: string;
  type: string;
  value: string;
  confidence: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
};
type EventRow = {
  id: string;
  customerId: string;
  source: string;
  externalId: string;
  eventType: string;
  occurredAt: Date;
  receivedAt: Date;
  payload: string;
};
type MergeRow = {
  id: string;
  winnerCustomerId: string;
  loserCustomerId: string;
  triggeredBySignalId: string | null;
  triggeredByEventId: string | null;
  reason: string;
  resolverVersion: string;
  createdAt: Date;
  reversedAt: Date | null;
};

type Store = {
  customers: CustomerRow[];
  signals: SignalRow[];
  events: EventRow[];
  merges: MergeRow[];
  clock: number;
};

let store: Store;

function nextId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function tick(): Date {
  store.clock += 1;
  return new Date(2026, 0, 1, 0, 0, 0, store.clock);
}

function makeTx() {
  return {
    customer: {
      create: async ({ data, select }: any) => {
        const row: CustomerRow = {
          id: nextId("c"),
          status: "active",
          mergedIntoId: null,
          createdAt: tick(),
          ...data,
        };
        store.customers.push(row);
        return select ? pick(row, select) : row;
      },
      findUnique: async ({ where, select }: any) => {
        const row = store.customers.find((c) => c.id === where.id);
        if (!row) return null;
        return select ? pick(row, select) : row;
      },
      findMany: async ({ where, select, orderBy, take }: any) => {
        let rows = store.customers.filter((c) => {
          if (where?.id?.in) return where.id.in.includes(c.id);
          return true;
        });
        if (orderBy?.createdAt === "asc") {
          rows = [...rows].sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
          );
        }
        if (typeof take === "number") rows = rows.slice(0, take);
        return rows.map((r) => (select ? pick(r, select) : r));
      },
      update: async ({ where, data }: any) => {
        const row = store.customers.find((c) => c.id === where.id);
        if (!row) throw new Error("customer not found");
        Object.assign(row, data);
        return row;
      },
    },
    identitySignal: {
      findUnique: async ({ where, select }: any) => {
        const row = store.signals.find(
          (s) =>
            s.type === where.type_value.type && s.value === where.type_value.value,
        );
        if (!row) return null;
        return select ? pick(row, select) : row;
      },
      findMany: async ({ where, select }: any) => {
        const rows = store.signals.filter((s) => {
          if (where.customerId && s.customerId !== where.customerId) return false;
          if (where.confidence && s.confidence !== where.confidence) return false;
          if (where.type && s.type !== where.type) return false;
          if (where.value && s.value !== where.value) return false;
          return true;
        });
        return rows.map((r) => (select ? pick(r, select) : r));
      },
      create: async ({ data }: any) => {
        const row: SignalRow = {
          id: nextId("s"),
          firstSeenAt: tick(),
          lastSeenAt: tick(),
          ...data,
        };
        store.signals.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = store.signals.find((s) => s.id === where.id);
        if (!row) throw new Error("signal not found");
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const s of store.signals) {
          if (where.customerId && s.customerId === where.customerId) {
            Object.assign(s, data);
            count++;
          }
        }
        return { count };
      },
    },
    event: {
      findUnique: async ({ where, select }: any) => {
        const row = store.events.find(
          (e) =>
            e.source === where.source_externalId.source &&
            e.externalId === where.source_externalId.externalId,
        );
        if (!row) return null;
        return select ? pick(row, select) : row;
      },
      create: async ({ data, select }: any) => {
        const row: EventRow = {
          id: nextId("e"),
          receivedAt: tick(),
          ...data,
        };
        store.events.push(row);
        return select ? pick(row, select) : row;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const e of store.events) {
          if (where.customerId && e.customerId === where.customerId) {
            Object.assign(e, data);
            count++;
          }
        }
        return { count };
      },
    },
    merge: {
      create: async ({ data, select }: any) => {
        const row: MergeRow = {
          id: nextId("m"),
          createdAt: tick(),
          reversedAt: null,
          ...data,
        };
        store.merges.push(row);
        return select ? pick(row, select) : row;
      },
    },
  };
}

function pick<T extends object>(row: T, select: Partial<Record<keyof T, true>>) {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(select)) out[key] = (row as any)[key];
  return out;
}

vi.mock("@/lib/db", () => {
  return {
    prisma: {
      $transaction: async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) =>
        fn(makeTx()),
    },
  };
});

import { resolveAndIngest, RESOLVER_VERSION } from "./resolver";
import type { ExtractedSignal } from "@/types/webhooks";

beforeEach(() => {
  store = { customers: [], signals: [], events: [], merges: [], clock: 0 };
});

const shopifyOrder1Signals: ExtractedSignal[] = [
  { type: "email", value: "jane.doe@example.com", confidence: "deterministic" },
  { type: "phone", value: "+61412345678", confidence: "deterministic" },
  { type: "device_id", value: "device_abc123", confidence: "probabilistic" },
  { type: "shopify_customer_id", value: "cust_shopify_001", confidence: "deterministic" },
];

const mindbodyBooking1Signals: ExtractedSignal[] = [
  { type: "email", value: "jane.doe@gmail.com", confidence: "deterministic" },
  { type: "phone", value: "+61412345678", confidence: "deterministic" },
  { type: "mindbody_client_id", value: "mb_client_001", confidence: "deterministic" },
];

const shopifyOrder2GuestSignals: ExtractedSignal[] = [
  { type: "device_id", value: "device_abc123", confidence: "probabilistic" },
];

describe("resolveAndIngest", () => {
  it("creates a new Customer when no signals match", async () => {
    const result = await resolveAndIngest({
      source: "shopify",
      externalId: "shopify_order_001",
      eventType: "order.created",
      occurredAt: new Date("2024-11-01T10:00:00Z"),
      payload: { foo: "bar" },
      signals: shopifyOrder1Signals,
    });

    expect(result.duplicate).toBe(false);
    expect(result.mergeIds).toEqual([]);
    expect(store.customers).toHaveLength(1);
    expect(store.customers[0].id).toBe(result.customerId);
    expect(store.signals).toHaveLength(4);
    expect(store.signals.every((s) => s.customerId === result.customerId)).toBe(true);
    expect(store.events).toHaveLength(1);
    expect(store.events[0].source).toBe("shopify");
    expect(store.events[0].externalId).toBe("shopify_order_001");
    expect(store.merges).toHaveLength(0);
  });

  it("is idempotent on (source, externalId)", async () => {
    const first = await resolveAndIngest({
      source: "shopify",
      externalId: "shopify_order_001",
      eventType: "order.created",
      occurredAt: new Date("2024-11-01T10:00:00Z"),
      payload: {},
      signals: shopifyOrder1Signals,
    });
    const second = await resolveAndIngest({
      source: "shopify",
      externalId: "shopify_order_001",
      eventType: "order.created",
      occurredAt: new Date("2024-11-01T10:00:00Z"),
      payload: {},
      signals: shopifyOrder1Signals,
    });

    expect(second.duplicate).toBe(true);
    expect(second.customerId).toBe(first.customerId);
    expect(second.eventId).toBe(first.eventId);
    expect(store.events).toHaveLength(1);
    expect(store.customers).toHaveLength(1);
    expect(store.signals).toHaveLength(4);
  });

  it("attaches a second event to the same Customer when signals overlap", async () => {
    const first = await resolveAndIngest({
      source: "shopify",
      externalId: "shopify_order_001",
      eventType: "order.created",
      occurredAt: new Date("2024-11-01T10:00:00Z"),
      payload: {},
      signals: shopifyOrder1Signals,
    });
    const second = await resolveAndIngest({
      source: "shopify",
      externalId: "shopify_order_002",
      eventType: "order.created",
      occurredAt: new Date("2024-11-10T14:30:00Z"),
      payload: {},
      signals: shopifyOrder2GuestSignals,
    });

    expect(second.customerId).toBe(first.customerId);
    expect(second.mergeIds).toEqual([]);
    expect(store.customers).toHaveLength(1);
    expect(store.events).toHaveLength(2);
    expect(store.merges).toHaveLength(0);
  });

  it("merges two existing Customers on a deterministic signal collision (phone)", async () => {
    const shopifyResult = await resolveAndIngest({
      source: "shopify",
      externalId: "shopify_order_001",
      eventType: "order.created",
      occurredAt: new Date("2024-11-01T10:00:00Z"),
      payload: {},
      signals: shopifyOrder1Signals,
    });
    const standaloneMindbody: ExtractedSignal[] = [
      { type: "email", value: "jane.doe@gmail.com", confidence: "deterministic" },
      { type: "mindbody_client_id", value: "mb_client_001", confidence: "deterministic" },
    ];
    const mindbodyResult = await resolveAndIngest({
      source: "mindbody",
      externalId: "mb_booking_seed",
      eventType: "booking.created",
      occurredAt: new Date("2024-11-04T08:00:00Z"),
      payload: {},
      signals: standaloneMindbody,
    });
    expect(mindbodyResult.customerId).not.toBe(shopifyResult.customerId);
    expect(store.customers).toHaveLength(2);

    const collidingResult = await resolveAndIngest({
      source: "mindbody",
      externalId: "mb_booking_001",
      eventType: "booking.created",
      occurredAt: new Date("2024-11-05T08:00:00Z"),
      payload: {},
      signals: mindbodyBooking1Signals,
    });

    expect(collidingResult.customerId).toBe(shopifyResult.customerId);
    expect(collidingResult.mergeIds).toHaveLength(1);

    const winnerSignals = store.signals.filter(
      (s) => s.customerId === shopifyResult.customerId,
    );
    expect(winnerSignals.map((s) => `${s.type}:${s.value}`).sort()).toEqual([
      "device_id:device_abc123",
      "email:jane.doe@example.com",
      "email:jane.doe@gmail.com",
      "mindbody_client_id:mb_client_001",
      "phone:+61412345678",
      "shopify_customer_id:cust_shopify_001",
    ]);

    const loser = store.customers.find((c) => c.id === mindbodyResult.customerId);
    expect(loser?.status).toBe("merged");
    expect(loser?.mergedIntoId).toBe(shopifyResult.customerId);

    expect(store.events.every((e) => e.customerId === shopifyResult.customerId)).toBe(true);

    expect(store.merges).toHaveLength(1);
    const merge = store.merges[0];
    expect(merge.winnerCustomerId).toBe(shopifyResult.customerId);
    expect(merge.loserCustomerId).toBe(mindbodyResult.customerId);
    expect(merge.resolverVersion).toBe(RESOLVER_VERSION);
    expect(merge.triggeredBySignalId).not.toBeNull();
    expect(merge.triggeredByEventId).not.toBeNull();
    expect(merge.reason).toMatch(/^deterministic_collision:/);
  });

  it("refuses to merge two Customers when only a probabilistic signal collides (shared-iPad protection)", async () => {
    const janeResult = await resolveAndIngest({
      source: "shopify",
      externalId: "shopify_order_001",
      eventType: "order.created",
      occurredAt: new Date("2024-11-01T10:00:00Z"),
      payload: {},
      signals: shopifyOrder1Signals,
    });

    const bobSignals: ExtractedSignal[] = [
      { type: "email", value: "bob@example.com", confidence: "deterministic" },
      { type: "device_id", value: "device_abc123", confidence: "probabilistic" },
      { type: "shopify_customer_id", value: "cust_shopify_002", confidence: "deterministic" },
    ];
    const bobResult = await resolveAndIngest({
      source: "shopify",
      externalId: "shopify_order_bob",
      eventType: "order.created",
      occurredAt: new Date("2024-11-02T10:00:00Z"),
      payload: {},
      signals: bobSignals,
    });

    expect(bobResult.customerId).not.toBe(janeResult.customerId);
    expect(bobResult.mergeIds).toEqual([]);
    expect(store.customers).toHaveLength(2);
    expect(store.merges).toHaveLength(0);
    expect(store.customers.filter((c) => c.status === "merged")).toHaveLength(0);

    const janeSignalsOnWinner = store.signals.filter(
      (s) => s.customerId === janeResult.customerId,
    );
    expect(janeSignalsOnWinner.find((s) => s.type === "device_id")).toBeDefined();
  });

  it("merges only when ≥2 customers are reached via deterministic signals (CONTRACTS §4 example)", async () => {
    const customerAResult = await resolveAndIngest({
      source: "shopify",
      externalId: "shopify_order_A",
      eventType: "order.created",
      occurredAt: new Date("2024-11-01T10:00:00Z"),
      payload: {},
      signals: [
        { type: "email", value: "a@example.com", confidence: "deterministic" },
        { type: "shopify_customer_id", value: "cust_A", confidence: "deterministic" },
      ],
    });
    const customerBResult = await resolveAndIngest({
      source: "mindbody",
      externalId: "mb_booking_B",
      eventType: "booking.created",
      occurredAt: new Date("2024-11-02T08:00:00Z"),
      payload: {},
      signals: [
        { type: "phone", value: "+61400000001", confidence: "deterministic" },
        { type: "mindbody_client_id", value: "mb_B", confidence: "deterministic" },
      ],
    });
    expect(customerAResult.customerId).not.toBe(customerBResult.customerId);

    const linkingResult = await resolveAndIngest({
      source: "shopify",
      externalId: "shopify_order_linking",
      eventType: "order.created",
      occurredAt: new Date("2024-11-03T10:00:00Z"),
      payload: {},
      signals: [
        { type: "email", value: "a@example.com", confidence: "deterministic" },
        { type: "phone", value: "+61400000001", confidence: "deterministic" },
      ],
    });

    expect(linkingResult.mergeIds).toHaveLength(1);
    expect(store.merges).toHaveLength(1);
    expect(store.merges[0].reason).toMatch(/^deterministic_collision:/);
  });

  it("stamps RESOLVER_VERSION and triggering signal/event on every Merge", async () => {
    await resolveAndIngest({
      source: "shopify",
      externalId: "shopify_order_001",
      eventType: "order.created",
      occurredAt: new Date("2024-11-01T10:00:00Z"),
      payload: {},
      signals: shopifyOrder1Signals,
    });
    await resolveAndIngest({
      source: "mindbody",
      externalId: "mb_booking_seed",
      eventType: "booking.created",
      occurredAt: new Date("2024-11-04T08:00:00Z"),
      payload: {},
      signals: [
        { type: "email", value: "jane.doe@gmail.com", confidence: "deterministic" },
        { type: "mindbody_client_id", value: "mb_client_001", confidence: "deterministic" },
      ],
    });
    await resolveAndIngest({
      source: "mindbody",
      externalId: "mb_booking_001",
      eventType: "booking.created",
      occurredAt: new Date("2024-11-05T08:00:00Z"),
      payload: {},
      signals: mindbodyBooking1Signals,
    });

    expect(store.merges).toHaveLength(1);
    for (const m of store.merges) {
      expect(m.resolverVersion).toBe(RESOLVER_VERSION);
      expect(m.triggeredBySignalId).toBeTruthy();
      expect(m.triggeredByEventId).toBeTruthy();
    }
  });
});
