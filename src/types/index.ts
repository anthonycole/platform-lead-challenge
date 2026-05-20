import { z } from "zod";

export const ShopifyOrderPayloadSchema = z.object({
  id: z.string().min(1),
  shopify_customer_id: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  device_id: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
  total_price: z.string().optional(),
  line_items: z
    .array(z.object({ title: z.string(), quantity: z.number() }))
    .optional(),
});

export const MindbodyBookingPayloadSchema = z.object({
  id: z.string().min(1),
  mindbody_client_id: z.string().min(1),
  client_email: z.string().nullable(),
  phone: z.string().nullable(),
  class_name: z.string(),
  scheduled_at: z.string().datetime({ offset: true }),
  studio: z.string().optional(),
});

export type ShopifyOrderPayload = z.infer<typeof ShopifyOrderPayloadSchema>;
export type MindbodyBookingPayload = z.infer<typeof MindbodyBookingPayloadSchema>;

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
