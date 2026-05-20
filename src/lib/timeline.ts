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

export type CustomerSummary = {
  customerId: string;
  status: string;
  matchedSignals: Array<{ type: string; value: string }>;
  primaryEmail: string | null;
  primaryPhone: string | null;
  lastActivityAt: Date | null;
};

export type SearchResult =
  | { kind: "multi"; results: CustomerSummary[] }
  | { kind: "none" };

// Two-phase search: exact identifier hit first, then substring fallback on
// email + phone. Either way we return summary cards — opening a profile is a
// separate action driven by ?customerId= rather than a search shortcut.
export async function searchCustomers(q: string): Promise<SearchResult> {
  const trimmed = q.trim();
  if (!trimmed) return { kind: "none" };

  const exact = await resolveExactCustomerId(trimmed);
  if (exact) {
    const summary = await buildCustomerSummary(exact.customerId, [
      { type: exact.type, value: exact.value },
    ]);
    if (summary) return { kind: "multi", results: [summary] };
  }

  const matches = await findPartialMatches(trimmed);
  if (matches.length === 0) return { kind: "none" };
  return { kind: "multi", results: matches };
}

async function resolveExactCustomerId(
  q: string,
): Promise<{ customerId: string; type: string; value: string } | null> {
  for (const type of LOOKUP_TYPES) {
    const value = normaliseSignal(type, q);
    if (!value) continue;
    const signal = await prisma.identitySignal.findUnique({
      where: { type_value: { type, value } },
      select: { customerId: true },
    });
    if (!signal) continue;
    const customerId = await followMergeChain(signal.customerId);
    return { customerId, type, value };
  }
  return null;
}

async function buildCustomerSummary(
  customerId: string,
  matchedSignals: Array<{ type: string; value: string }>,
): Promise<CustomerSummary | null> {
  const [customer, signals, latest] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { status: true },
    }),
    prisma.identitySignal.findMany({
      where: { customerId, type: { in: ["email", "phone"] } },
      select: { type: true, value: true, lastSeenAt: true },
      orderBy: { lastSeenAt: "desc" },
    }),
    prisma.event.findMany({
      where: { customerId },
      select: { occurredAt: true },
      orderBy: { occurredAt: "desc" },
      take: 1,
    }),
  ]);
  if (!customer) return null;
  return {
    customerId,
    status: customer.status,
    matchedSignals,
    primaryEmail: signals.find((s) => s.type === "email")?.value ?? null,
    primaryPhone: signals.find((s) => s.type === "phone")?.value ?? null,
    lastActivityAt: latest[0]?.occurredAt ?? null,
  };
}

async function findPartialMatches(q: string): Promise<CustomerSummary[]> {
  const emailNeedle = q.toLowerCase();
  const phoneDigits = q.replace(/\D+/g, "");

  // Substring against the raw stored email value (already lowercased on insert
  // via normaliseSignal). Also include the raw query for phone-style searches
  // that may contain a leading + or punctuation.
  const candidates = await prisma.identitySignal.findMany({
    where: {
      OR: [
        { type: "email", value: { contains: emailNeedle } },
        ...(phoneDigits.length >= 3
          ? [
              { type: "phone" as const, value: { contains: phoneDigits } },
              { type: "phone" as const, value: { contains: q } },
            ]
          : []),
      ],
    },
    select: {
      type: true,
      value: true,
      customerId: true,
    },
    take: 100,
  });

  if (candidates.length === 0) return [];

  // Collapse signals to canonical customers via merge chain.
  const matchedByCustomer = new Map<string, Array<{ type: string; value: string }>>();
  for (const c of candidates) {
    const activeId = await followMergeChain(c.customerId);
    const existing = matchedByCustomer.get(activeId);
    if (existing) {
      if (!existing.some((s) => s.type === c.type && s.value === c.value)) {
        existing.push({ type: c.type, value: c.value });
      }
      continue;
    }
    matchedByCustomer.set(activeId, [{ type: c.type, value: c.value }]);
  }

  const summaries = (
    await Promise.all(
      Array.from(matchedByCustomer.entries()).map(([id, matched]) =>
        buildCustomerSummary(id, matched),
      ),
    )
  ).filter((s): s is CustomerSummary => s !== null);

  summaries.sort((a, b) => {
    const aT = a.lastActivityAt?.getTime() ?? 0;
    const bT = b.lastActivityAt?.getTime() ?? 0;
    return bT - aT;
  });
  return summaries;
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

export async function loadCustomerView(customerId: string): Promise<CustomerView | null> {
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
