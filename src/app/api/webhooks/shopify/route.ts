import { NextRequest, NextResponse } from "next/server";
import { extractShopifySignals } from "@/lib/signals";
import { resolveAndIngest } from "@/lib/resolver";
import { ShopifyOrderPayloadSchema } from "@/types/webhooks";

export async function POST(req: NextRequest) {
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
    console.error("shopify webhook error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
