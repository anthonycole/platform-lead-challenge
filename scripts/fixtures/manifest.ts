export type FixtureEntry = {
  source: "shopify" | "mindbody";
  file: string;
  note: string;
};

export const manifest: FixtureEntry[] = [
  {
    source: "shopify",
    file: "shopify/order_001_jane_auth.json",
    note: "Creates Customer A — authenticated Shopify order with email, phone, device, shopify_customer_id.",
  },
  {
    source: "mindbody",
    file: "mindbody/booking_001_jane_phone_link.json",
    note: "Phone matches A → attaches to A, adds new email (jane.doe@gmail.com) and mindbody_client_id signals.",
  },
  {
    source: "shopify",
    file: "shopify/order_002_guest_device.json",
    note: "Guest checkout — only device_id; probabilistic match to A.",
  },
  {
    source: "shopify",
    file: "shopify/order_001_jane_auth_DUPLICATE.json",
    note: "Duplicate of #1 — dedupe via (source, externalId); no new Event row.",
  },
  {
    source: "mindbody",
    file: "mindbody/booking_002_bob_solo.json",
    note: "Creates Customer B (Bob) — no overlap with A.",
  },
  {
    source: "shopify",
    file: "shopify/order_003_bob_linker.json",
    note: "Email matches B → attaches to B, adds new phone (+61477777777) and shopify_customer_id signals.",
  },
  {
    source: "mindbody",
    file: "mindbody/booking_003_carol.json",
    note: "Creates Customer C (Carol) — no overlap with A or B.",
  },
  {
    source: "shopify",
    file: "shopify/order_004_collision.json",
    note: "Collision — email resolves to C, phone (+61477777777) resolves to B. Forces cross-profile merge; older Customer (B) wins.",
  },
];
