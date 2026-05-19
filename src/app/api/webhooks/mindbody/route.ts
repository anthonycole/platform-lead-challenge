import { NextRequest, NextResponse } from "next/server";
import { extractMindbodySignals } from "@/lib/signals";
import { resolveAndIngest } from "@/lib/resolver";
import type { MindbodyBookingPayload } from "@/types/webhooks";

function isMindbodyBooking(body: unknown): body is MindbodyBookingPayload {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.id === "string" &&
    typeof b.mindbody_client_id === "string" &&
    typeof b.scheduled_at === "string" &&
    typeof b.class_name === "string" &&
    (b.client_email === null || typeof b.client_email === "string") &&
    (b.phone === null || typeof b.phone === "string")
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!isMindbodyBooking(body)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const occurredAt = new Date(body.scheduled_at);
  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: "invalid scheduled_at" }, { status: 400 });
  }

  try {
    await resolveAndIngest({
      source: "mindbody",
      externalId: body.id,
      eventType: "booking.created",
      occurredAt,
      payload: body,
      signals: extractMindbodySignals(body),
    });
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("mindbody webhook error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
