/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from "vitest";

type CustomerRow = {
  id: string;
  status: string;
  mergedIntoId: string | null;
  createdAt: Date;
  updatedAt: Date;
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

type Store = {
  customers: CustomerRow[];
  signals: SignalRow[];
  events: EventRow[];
};

let store: Store;

function pick<T extends object>(row: T, select: Partial<Record<keyof T, true>>) {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(select)) out[key] = (row as any)[key];
  return out;
}

vi.mock("@/lib/db", () => {
  return {
    prisma: {
      customer: {
        findUnique: async ({ where, select }: any) => {
          const row = store.customers.find((c) => c.id === where.id);
          if (!row) return null;
          return select ? pick(row, select) : row;
        },
      },
      identitySignal: {
        findUnique: async ({ where, select }: any) => {
          const row = store.signals.find(
            (s) =>
              s.type === where.type_value.type &&
              s.value === where.type_value.value,
          );
          if (!row) return null;
          return select ? pick(row, select) : row;
        },
        findMany: async ({ where, select, orderBy }: any) => {
          let rows = store.signals.filter((s) => s.customerId === where.customerId);
          if (orderBy?.firstSeenAt === "asc") {
            rows = [...rows].sort(
              (a, b) => a.firstSeenAt.getTime() - b.firstSeenAt.getTime(),
            );
          }
          return rows.map((r) => (select ? pick(r, select) : r));
        },
      },
      event: {
        findMany: async ({ where, select, orderBy }: any) => {
          let rows = store.events.filter((e) => e.customerId === where.customerId);
          if (orderBy?.occurredAt === "desc") {
            rows = [...rows].sort(
              (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
            );
          }
          return rows.map((r) => (select ? pick(r, select) : r));
        },
      },
    },
  };
});

import { getCustomerByQuery } from "./timeline";

beforeEach(() => {
  store = { customers: [], signals: [], events: [] };
});

function seedCustomer(id: string, opts: Partial<CustomerRow> = {}): CustomerRow {
  const row: CustomerRow = {
    id,
    status: "active",
    mergedIntoId: null,
    createdAt: new Date("2024-11-01T10:00:00Z"),
    updatedAt: new Date("2024-11-01T10:00:00Z"),
    ...opts,
  };
  store.customers.push(row);
  return row;
}

function seedSignal(
  customerId: string,
  type: string,
  value: string,
  confidence = "deterministic",
): SignalRow {
  const row: SignalRow = {
    id: `s_${store.signals.length + 1}`,
    customerId,
    type,
    value,
    confidence,
    firstSeenAt: new Date("2024-11-01T10:00:00Z"),
    lastSeenAt: new Date("2024-11-01T10:00:00Z"),
  };
  store.signals.push(row);
  return row;
}

function seedEvent(
  customerId: string,
  externalId: string,
  occurredAt: string,
  payload: unknown = {},
): EventRow {
  const row: EventRow = {
    id: `e_${store.events.length + 1}`,
    customerId,
    source: "shopify",
    externalId,
    eventType: "order.created",
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(occurredAt),
    payload: JSON.stringify(payload),
  };
  store.events.push(row);
  return row;
}

describe("getCustomerByQuery", () => {
  it("returns null when no signal matches", async () => {
    seedCustomer("c1");
    seedSignal("c1", "email", "jane@example.com");

    const result = await getCustomerByQuery("nobody@nowhere.com");
    expect(result).toBeNull();
  });

  it("looks up by email and returns the customer view", async () => {
    seedCustomer("c1");
    seedSignal("c1", "email", "jane@example.com");
    seedEvent("c1", "ord_1", "2024-11-01T10:00:00Z", { total: "89.00" });

    const result = await getCustomerByQuery("jane@example.com");
    expect(result).not.toBeNull();
    expect(result!.customer.id).toBe("c1");
    expect(result!.signals).toHaveLength(1);
    expect(result!.events).toHaveLength(1);
    expect(result!.events[0].payload).toEqual({ total: "89.00" });
  });

  it("normalises the query before lookup (case-insensitive email)", async () => {
    seedCustomer("c1");
    seedSignal("c1", "email", "jane.doe@example.com");

    const result = await getCustomerByQuery("  JANE.DOE@Example.COM ");
    expect(result?.customer.id).toBe("c1");
  });

  it("normalises whitespace in phone queries", async () => {
    seedCustomer("c1");
    seedSignal("c1", "phone", "+61412345678");

    const result = await getCustomerByQuery("+61 412 345 678");
    expect(result?.customer.id).toBe("c1");
  });

  it("looks up by platform ID", async () => {
    seedCustomer("c1");
    seedSignal("c1", "shopify_customer_id", "cust_shopify_001");

    const result = await getCustomerByQuery("cust_shopify_001");
    expect(result?.customer.id).toBe("c1");
  });

  it("looks up by device_id (probabilistic)", async () => {
    seedCustomer("c1");
    seedSignal("c1", "device_id", "device_abc123", "probabilistic");

    const result = await getCustomerByQuery("device_abc123");
    expect(result?.customer.id).toBe("c1");
  });

  it("follows mergedIntoId to the active winner customer", async () => {
    seedCustomer("winner");
    seedCustomer("loser", { status: "merged", mergedIntoId: "winner" });
    seedSignal("loser", "email", "loser@example.com");
    seedEvent("winner", "ord_winner", "2024-11-05T10:00:00Z");

    const result = await getCustomerByQuery("loser@example.com");
    expect(result?.customer.id).toBe("winner");
    expect(result?.events).toHaveLength(1);
    expect(result?.events[0].externalId).toBe("ord_winner");
  });

  it("orders events by occurredAt descending", async () => {
    seedCustomer("c1");
    seedSignal("c1", "email", "jane@example.com");
    seedEvent("c1", "ord_first", "2024-11-01T10:00:00Z");
    seedEvent("c1", "ord_third", "2024-11-10T10:00:00Z");
    seedEvent("c1", "ord_second", "2024-11-05T10:00:00Z");

    const result = await getCustomerByQuery("jane@example.com");
    expect(result?.events.map((e) => e.externalId)).toEqual([
      "ord_third",
      "ord_second",
      "ord_first",
    ]);
  });

  it("returns parsed payload (not the raw JSON string)", async () => {
    seedCustomer("c1");
    seedSignal("c1", "email", "jane@example.com");
    seedEvent("c1", "ord_1", "2024-11-01T10:00:00Z", {
      total_price: "89.00",
      line_items: [{ title: "Band", quantity: 1 }],
    });

    const result = await getCustomerByQuery("jane@example.com");
    expect(result?.events[0].payload).toEqual({
      total_price: "89.00",
      line_items: [{ title: "Band", quantity: 1 }],
    });
  });
});
