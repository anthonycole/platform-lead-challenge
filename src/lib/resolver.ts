import { prisma } from "@/lib/db";
import type { ExtractedSignal } from "@/types";
import type { PrismaClient } from "@/generated/prisma/client";

export const RESOLVER_VERSION = "v1.0.0";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export type IngestInput = {
  source: "shopify" | "mindbody";
  externalId: string;
  eventType: string;
  occurredAt: Date;
  payload: unknown;
  signals: ExtractedSignal[];
};

export type IngestResult = {
  customerId: string;
  eventId: string;
  duplicate: boolean;
  mergeIds: string[];
};

export async function resolveAndIngest(
  input: IngestInput,
): Promise<IngestResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.event.findUnique({
      where: {
        source_externalId: { source: input.source, externalId: input.externalId },
      },
      select: { id: true, customerId: true },
    });
    if (existing) {
      return {
        customerId: existing.customerId,
        eventId: existing.id,
        duplicate: true,
        mergeIds: [],
      };
    }

    const matched = await matchSignals(tx, input.signals);
    const distinctCustomerIds = [
      ...new Set(matched.map((m) => m.customerId).filter((id): id is string => !!id)),
    ];
    const deterministicMatchedCustomerIds = [
      ...new Set(
        matched
          .filter((m) => m.signal.confidence === "deterministic" && m.customerId)
          .map((m) => m.customerId as string),
      ),
    ];
    const hasDeterministicSignals = input.signals.some(
      (s) => s.confidence === "deterministic",
    );

    let customerId: string;
    const mergeIds: string[] = [];

    if (distinctCustomerIds.length === 0) {
      const created = await tx.customer.create({ data: {}, select: { id: true } });
      customerId = created.id;
    } else if (
      deterministicMatchedCustomerIds.length === 0 &&
      hasDeterministicSignals
    ) {
      const created = await tx.customer.create({ data: {}, select: { id: true } });
      customerId = created.id;
    } else if (distinctCustomerIds.length === 1) {
      customerId = distinctCustomerIds[0];
    } else if (deterministicMatchedCustomerIds.length === 0) {
      customerId = await pickProbabilisticOnlyWinner(tx, distinctCustomerIds);
    } else {
      customerId = await pickOldestCustomer(tx, deterministicMatchedCustomerIds);
    }

    const event = await tx.event.create({
      data: {
        customerId,
        source: input.source,
        externalId: input.externalId,
        eventType: input.eventType,
        occurredAt: input.occurredAt,
        payload: JSON.stringify(input.payload),
      },
      select: { id: true },
    });

    await attachSignals(tx, customerId, input.signals, matched);

    if (deterministicMatchedCustomerIds.length >= 2) {
      const losers = deterministicMatchedCustomerIds.filter((id) => id !== customerId);
      for (const loserId of losers) {
        const trigger = matched.find(
          (m) =>
            m.customerId === loserId && m.signal.confidence === "deterministic",
        );
        if (!trigger) continue;
        const merge = await mergeInto(tx, {
          winnerId: customerId,
          loserId,
          triggerSignalId: trigger.signalId,
          triggerEventId: event.id,
          reason: `deterministic_collision:${trigger.signal.type}`,
        });
        mergeIds.push(merge.id);
      }
    }

    let cascaded = await findCollidingSignal(tx, customerId);
    while (cascaded) {
      const merge = await mergeInto(tx, {
        winnerId: customerId,
        loserId: cascaded.otherCustomerId,
        triggerSignalId: cascaded.signalId,
        triggerEventId: event.id,
        reason: `cascading_merge:${cascaded.signalType}`,
      });
      mergeIds.push(merge.id);
      cascaded = await findCollidingSignal(tx, customerId);
    }

    return { customerId, eventId: event.id, duplicate: false, mergeIds };
  });
}

type MatchedSignal = {
  signal: ExtractedSignal;
  signalId: string | null;
  customerId: string | null;
};

async function matchSignals(
  tx: Tx,
  signals: ExtractedSignal[],
): Promise<MatchedSignal[]> {
  const out: MatchedSignal[] = [];
  for (const signal of signals) {
    const existing = await tx.identitySignal.findUnique({
      where: { type_value: { type: signal.type, value: signal.value } },
      select: { id: true, customerId: true },
    });
    if (!existing) {
      out.push({ signal, signalId: null, customerId: null });
      continue;
    }
    const activeCustomerId = await followMergeChain(tx, existing.customerId);
    out.push({ signal, signalId: existing.id, customerId: activeCustomerId });
  }
  return out;
}

async function followMergeChain(tx: Tx, customerId: string): Promise<string> {
  let current = customerId;
  const seen = new Set<string>();
  for (;;) {
    if (seen.has(current)) return current;
    seen.add(current);
    const c = await tx.customer.findUnique({
      where: { id: current },
      select: { status: true, mergedIntoId: true },
    });
    if (!c || c.status !== "merged" || !c.mergedIntoId) return current;
    current = c.mergedIntoId;
  }
}

async function pickOldestCustomer(tx: Tx, ids: string[]): Promise<string> {
  const rows = await tx.customer.findMany({
    where: { id: { in: ids } },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 1,
  });
  return rows[0].id;
}

async function pickProbabilisticOnlyWinner(
  tx: Tx,
  ids: string[],
): Promise<string> {
  return pickOldestCustomer(tx, ids);
}

async function attachSignals(
  tx: Tx,
  customerId: string,
  signals: ExtractedSignal[],
  matched: MatchedSignal[],
) {
  const now = new Date();
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    const m = matched[i];
    if (m.signalId) {
      if (m.customerId === customerId) {
        await tx.identitySignal.update({
          where: { id: m.signalId },
          data: { lastSeenAt: now },
        });
      } else if (signal.confidence === "probabilistic") {
        continue;
      } else {
        await tx.identitySignal.update({
          where: { id: m.signalId },
          data: { customerId, lastSeenAt: now },
        });
      }
    } else {
      await tx.identitySignal.create({
        data: {
          customerId,
          type: signal.type,
          value: signal.value,
          confidence: signal.confidence,
        },
      });
    }
  }
}

type MergeArgs = {
  winnerId: string;
  loserId: string;
  triggerSignalId: string | null;
  triggerEventId: string | null;
  reason: string;
};

async function mergeInto(tx: Tx, args: MergeArgs) {
  await tx.event.updateMany({
    where: { customerId: args.loserId },
    data: { customerId: args.winnerId },
  });
  await tx.identitySignal.updateMany({
    where: { customerId: args.loserId },
    data: { customerId: args.winnerId },
  });
  await tx.customer.update({
    where: { id: args.loserId },
    data: { status: "merged", mergedIntoId: args.winnerId },
  });
  return tx.merge.create({
    data: {
      winnerCustomerId: args.winnerId,
      loserCustomerId: args.loserId,
      triggeredBySignalId: args.triggerSignalId,
      triggeredByEventId: args.triggerEventId,
      reason: args.reason,
      resolverVersion: RESOLVER_VERSION,
    },
    select: { id: true },
  });
}

async function findCollidingSignal(
  tx: Tx,
  winnerId: string,
): Promise<{ otherCustomerId: string; signalId: string; signalType: string } | null> {
  const winnerSignals = await tx.identitySignal.findMany({
    where: { customerId: winnerId, confidence: "deterministic" },
    select: { type: true, value: true },
  });
  if (winnerSignals.length === 0) return null;

  for (const s of winnerSignals) {
    const matches = await tx.identitySignal.findMany({
      where: { type: s.type, value: s.value },
      select: { id: true, customerId: true, type: true },
    });
    const other = matches.find((m) => m.customerId !== winnerId);
    if (other) {
      const activeOther = await followMergeChain(tx, other.customerId);
      if (activeOther !== winnerId) {
        return {
          otherCustomerId: activeOther,
          signalId: other.id,
          signalType: other.type,
        };
      }
    }
  }
  return null;
}
