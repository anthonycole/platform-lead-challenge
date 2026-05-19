import { NextRequest, NextResponse } from "next/server";
import { extractShopifySignals } from "@/lib/signals";
import { resolveAndIngest } from "@/lib/resolver";
import type { ShopifyOrderPayload } from "@/types/webhooks";

function isShopifyOrder(body: unknown): body is ShopifyOrderPayload {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.id === "string" &&
    typeof b.created_at === "string" &&
    (b.email === null || typeof b.email === "string") &&
    (b.phone === null || typeof b.phone === "string") &&
    (b.device_id === null || typeof b.device_id === "string") &&
    (b.shopify_customer_id === null || typeof b.shopify_customer_id === "string")
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!isShopifyOrder(body)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const occurredAt = new Date(body.created_at);
  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: "invalid created_at" }, { status: 400 });
  }

  try {
    await resolveAndIngest({
      source: "shopify",
      externalId: body.id,
      eventType: "order.created",
      occurredAt,
      payload: body,
      signals: extractShopifySignals(body),
    });
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("shopify webhook error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
