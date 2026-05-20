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
        findMany: async ({ where, select, orderBy, take }: any) => {
          let rows: SignalRow[];
          if (where?.OR) {
            rows = store.signals.filter((s) =>
              where.OR.some((clause: any) => {
                if (clause.type && s.type !== clause.type) return false;
                const v = clause.value;
                if (v?.contains && !s.value.includes(v.contains)) return false;
                return true;
              }),
            );
          } else if (where?.customerId) {
            rows = store.signals.filter((s) => s.customerId === where.customerId);
            if (where.type?.in) {
              rows = rows.filter((s) => where.type.in.includes(s.type));
            }
          } else {
            rows = [...store.signals];
          }
          if (orderBy?.firstSeenAt === "asc") {
            rows = [...rows].sort(
              (a, b) => a.firstSeenAt.getTime() - b.firstSeenAt.getTime(),
            );
          }
          if (orderBy?.lastSeenAt === "desc") {
            rows = [...rows].sort(
              (a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime(),
            );
          }
          if (typeof take === "number") rows = rows.slice(0, take);
          return rows.map((r) => (select ? pick(r, select) : r));
        },
      },
      event: {
        findMany: async ({ where, select, orderBy, take }: any) => {
          let rows = store.events.filter((e) => e.customerId === where.customerId);
          if (orderBy?.occurredAt === "desc") {
            rows = [...rows].sort(
              (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
            );
          }
          if (typeof take === "number") rows = rows.slice(0, take);
          return rows.map((r) => (select ? pick(r, select) : r));
        },
      },
    },
  };
});

import { getCustomerByQuery, searchCustomers } from "./timeline";

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

describe("searchCustomers", () => {
  it("returns 'none' for empty queries", async () => {
    expect(await searchCustomers("")).toEqual({ kind: "none" });
    expect(await searchCustomers("   ")).toEqual({ kind: "none" });
  });

  it("returns a single-result 'multi' when the query is an exact signal match", async () => {
    seedCustomer("c1");
    seedSignal("c1", "email", "jane.doe@example.com");
    seedEvent("c1", "ord_1", "2024-11-01T10:00:00Z");

    const result = await searchCustomers("jane.doe@example.com");
    expect(result.kind).toBe("multi");
    if (result.kind === "multi") {
      expect(result.results).toHaveLength(1);
      expect(result.results[0].customerId).toBe("c1");
      expect(result.results[0].matchedSignals).toEqual([
        { type: "email", value: "jane.doe@example.com" },
      ]);
    }
  });

  it("returns a single-result 'multi' when a partial email substring resolves to exactly one customer", async () => {
    seedCustomer("c1");
    seedSignal("c1", "email", "jane.doe@example.com");
    seedEvent("c1", "ord_1", "2024-11-01T10:00:00Z");

    const result = await searchCustomers("jane");
    expect(result.kind).toBe("multi");
    if (result.kind === "multi") {
      expect(result.results).toHaveLength(1);
      expect(result.results[0].customerId).toBe("c1");
    }
  });

  it("returns 'multi' with deduped canonical customers when several match", async () => {
    seedCustomer("c1");
    seedCustomer("c2");
    seedSignal("c1", "email", "jane.doe@example.com");
    seedSignal("c2", "email", "jane.smith@gmail.com");
    seedEvent("c1", "ord_1", "2024-11-01T10:00:00Z");
    seedEvent("c2", "ord_2", "2024-11-05T10:00:00Z");

    const result = await searchCustomers("jane");
    expect(result.kind).toBe("multi");
    if (result.kind === "multi") {
      const ids = result.results.map((r) => r.customerId).sort();
      expect(ids).toEqual(["c1", "c2"]);
      // sorted by lastActivity desc — c2 is newer
      expect(result.results[0].customerId).toBe("c2");
    }
  });

  it("collapses partial matches that resolve to the same canonical customer (merge chain)", async () => {
    seedCustomer("winner");
    seedCustomer("loser", { status: "merged", mergedIntoId: "winner" });
    seedSignal("winner", "email", "jane.doe@example.com");
    seedSignal("loser", "email", "jane.alt@example.com");
    seedEvent("winner", "ord_1", "2024-11-01T10:00:00Z");

    const result = await searchCustomers("jane");
    // Two signal matches that both resolve to "winner" should collapse to one row.
    expect(result.kind).toBe("multi");
    if (result.kind === "multi") {
      expect(result.results).toHaveLength(1);
      expect(result.results[0].customerId).toBe("winner");
    }
  });

  it("matches phone substrings (digit-only and raw)", async () => {
    seedCustomer("c1");
    seedSignal("c1", "phone", "+61412345678");
    seedEvent("c1", "ord_1", "2024-11-01T10:00:00Z");

    const digitMatch = await searchCustomers("412345");
    expect(digitMatch.kind).toBe("multi");
    if (digitMatch.kind === "multi") {
      expect(digitMatch.results[0].customerId).toBe("c1");
    }

    const rawMatch = await searchCustomers("+61412");
    expect(rawMatch.kind).toBe("multi");
    if (rawMatch.kind === "multi") {
      expect(rawMatch.results[0].customerId).toBe("c1");
    }
  });

  it("returns 'none' when nothing matches", async () => {
    seedCustomer("c1");
    seedSignal("c1", "email", "jane.doe@example.com");

    const result = await searchCustomers("nobody");
    expect(result).toEqual({ kind: "none" });
  });
});
