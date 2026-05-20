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
      return normalisePhone(trimmed);
    case "device_id":
    case "shopify_customer_id":
    case "mindbody_client_id":
      return trimmed;
  }
}

// Lightweight E.164-ish normaliser. KIC is AU-based, so a leading 0 is treated
// as an Australian national number. Anything already prefixed with + is kept
// as-is (minus separators). Bare digit strings get a + prepended so search by
// "61412345678" still matches a stored "+61412345678".
function normalisePhone(raw: string): string | null {
  const hasPlus = raw.trimStart().startsWith("+");
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  if (hasPlus) return `+${digits}`;
  if (digits.startsWith("0")) return `+61${digits.slice(1)}`;
  return `+${digits}`;
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
