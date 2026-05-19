import type {
  ExtractedSignal,
  MindbodyBookingPayload,
  ShopifyOrderPayload,
  SignalConfidence,
  SignalType,
} from "@/types/webhooks";

const CONFIDENCE: Record<SignalType, SignalConfidence> = {
  email: "deterministic",
  phone: "deterministic",
  shopify_customer_id: "deterministic",
  mindbody_client_id: "deterministic",
  device_id: "probabilistic",
};

export function normaliseSignal(type: SignalType, raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  switch (type) {
    case "email":
      return trimmed.toLowerCase();
    case "phone":
      return trimmed.replace(/\s+/g, "");
    case "device_id":
    case "shopify_customer_id":
    case "mindbody_client_id":
      return trimmed;
  }
}

function build(type: SignalType, raw: unknown): ExtractedSignal | null {
  const value = normaliseSignal(type, raw);
  if (!value) return null;
  return { type, value, confidence: CONFIDENCE[type] };
}

export function extractShopifySignals(
  payload: ShopifyOrderPayload,
): ExtractedSignal[] {
  return [
    build("email", payload.email),
    build("phone", payload.phone),
    build("device_id", payload.device_id),
    build("shopify_customer_id", payload.shopify_customer_id),
  ].filter((s): s is ExtractedSignal => s !== null);
}

export function extractMindbodySignals(
  payload: MindbodyBookingPayload,
): ExtractedSignal[] {
  return [
    build("email", payload.client_email),
    build("phone", payload.phone),
    build("mindbody_client_id", payload.mindbody_client_id),
  ].filter((s): s is ExtractedSignal => s !== null);
}
