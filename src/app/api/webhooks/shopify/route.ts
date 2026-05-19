import { NextRequest, NextResponse } from "next/server";
import { extractShopifySignals } from "@/lib/signals";
import { resolveAndIngest } from "@/lib/resolver";
import { logger } from "@/lib/logger";
import { ShopifyOrderPayloadSchema } from "@/types/webhooks";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = logger.child({ route: "webhooks/shopify", requestId });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = ShopifyOrderPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    await resolveAndIngest({
      source: "shopify",
      externalId: parsed.data.id,
      eventType: "order.created",
      occurredAt: new Date(parsed.data.created_at),
      payload: parsed.data,
      signals: extractShopifySignals(parsed.data),
    });
    return NextResponse.json({ received: true });
  } catch (err) {
    log.error(
      {
        err,
        source: "shopify",
        externalId: parsed.data.id,
        eventType: "order.created",
      },
      "shopify webhook failed",
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
