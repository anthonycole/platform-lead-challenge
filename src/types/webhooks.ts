export type ShopifyOrderPayload = {
  id: string;
  shopify_customer_id: string | null;
  email: string | null;
  phone: string | null;
  device_id: string | null;
  created_at: string;
  total_price?: string;
  line_items?: Array<{ title: string; quantity: number }>;
};

export type MindbodyBookingPayload = {
  id: string;
  mindbody_client_id: string;
  client_email: string | null;
  phone: string | null;
  class_name: string;
  scheduled_at: string;
  studio?: string;
};

export type SignalType =
  | "email"
  | "phone"
  | "device_id"
  | "shopify_customer_id"
  | "mindbody_client_id";

export type SignalConfidence = "deterministic" | "probabilistic";

export type ExtractedSignal = {
  type: SignalType;
  value: string;
  confidence: SignalConfidence;
};
