import { prisma } from "@/lib/db";
import { normaliseSignal } from "@/lib/signals";
import type { SignalType } from "@/types/webhooks";

const LOOKUP_TYPES: SignalType[] = [
  "email",
  "phone",
  "shopify_customer_id",
  "mindbody_client_id",
  "device_id",
];

export type CustomerView = {
  customer: {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  signals: Array<{
    type: string;
    value: string;
    confidence: string;
    firstSeenAt: Date;
    lastSeenAt: Date;
  }>;
  events: Array<{
    id: string;
    source: string;
    externalId: string;
    eventType: string;
    occurredAt: Date;
    receivedAt: Date;
    payload: unknown;
  }>;
};

export async function getCustomerByQuery(
  q: string,
): Promise<CustomerView | null> {
  for (const type of LOOKUP_TYPES) {
    const value = normaliseSignal(type, q);
    if (!value) continue;
    const signal = await prisma.identitySignal.findUnique({
      where: { type_value: { type, value } },
      select: { customerId: true },
    });
    if (!signal) continue;

    const activeId = await followMergeChain(signal.customerId);
    return loadCustomerView(activeId);
  }
  return null;
}

async function followMergeChain(customerId: string): Promise<string> {
  let current = customerId;
  const seen = new Set<string>();
  for (;;) {
    if (seen.has(current)) return current;
    seen.add(current);
    const c = await prisma.customer.findUnique({
      where: { id: current },
      select: { status: true, mergedIntoId: true },
    });
    if (!c || c.status !== "merged" || !c.mergedIntoId) return current;
    current = c.mergedIntoId;
  }
}

async function loadCustomerView(customerId: string): Promise<CustomerView | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, status: true, createdAt: true, updatedAt: true },
  });
  if (!customer) return null;

  const [signals, events] = await Promise.all([
    prisma.identitySignal.findMany({
      where: { customerId },
      select: {
        type: true,
        value: true,
        confidence: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
      orderBy: { firstSeenAt: "asc" },
    }),
    prisma.event.findMany({
      where: { customerId },
      select: {
        id: true,
        source: true,
        externalId: true,
        eventType: true,
        occurredAt: true,
        receivedAt: true,
        payload: true,
      },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  return {
    customer,
    signals,
    events: events.map((e) => ({
      ...e,
      payload: safeParseJson(e.payload),
    })),
  };
}

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
