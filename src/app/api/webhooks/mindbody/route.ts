import { NextRequest, NextResponse } from "next/server";
import { extractMindbodySignals } from "@/lib/signals";
import { resolveAndIngest } from "@/lib/resolver";
import { MindbodyBookingPayloadSchema } from "@/types/webhooks";

export async function POST(req: NextRequest) {
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
    console.error("mindbody webhook error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
