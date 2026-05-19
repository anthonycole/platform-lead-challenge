import { NextRequest, NextResponse } from "next/server";
import { extractMindbodySignals } from "@/lib/signals";
import { resolveAndIngest } from "@/lib/resolver";
import { logger } from "@/lib/logger";
import { MindbodyBookingPayloadSchema } from "@/types/webhooks";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = logger.child({ route: "webhooks/mindbody", requestId });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = MindbodyBookingPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    await resolveAndIngest({
      source: "mindbody",
      externalId: parsed.data.id,
      eventType: "booking.created",
      occurredAt: new Date(parsed.data.scheduled_at),
      payload: parsed.data,
      signals: extractMindbodySignals(parsed.data),
    });
    return NextResponse.json({ received: true });
  } catch (err) {
    log.error(
      {
        err,
        source: "mindbody",
        externalId: parsed.data.id,
        eventType: "booking.created",
      },
      "mindbody webhook failed",
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
