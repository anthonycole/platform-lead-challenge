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

  // --- Volume / depth fixtures (no new resolution behaviour) ---
  // The entries above are the identity-resolution demo and run first. Everything
  // below is happy-path activity that resolves cleanly onto existing or new
  // customers, to give the list view, profile timelines, and metrics more to show.

  // Jane (A) — repeat customer, deeper timeline.
  {
    source: "shopify",
    file: "shopify/order_005_jane_repeat.json",
    note: "Repeat Shopify order for Jane (A) via shopify_customer_id; adds to lifetime spend.",
  },
  {
    source: "shopify",
    file: "shopify/order_006_jane_repeat.json",
    note: "Another Jane (A) order, multi-item; her most recent order.",
  },
  {
    source: "mindbody",
    file: "mindbody/booking_004_jane_repeat.json",
    note: "Repeat Mindbody booking for Jane (A) via mindbody_client_id / phone.",
  },

  // Bob (B) — second order + booking.
  {
    source: "shopify",
    file: "shopify/order_007_bob_repeat.json",
    note: "Repeat Shopify order for Bob (B) via shopify_customer_id.",
  },
  {
    source: "mindbody",
    file: "mindbody/booking_005_bob_repeat.json",
    note: "Repeat Mindbody booking for Bob (B).",
  },

  // Carol (C) — second order + booking.
  {
    source: "shopify",
    file: "shopify/order_008_carol_repeat.json",
    note: "Repeat Shopify order for Carol (C) via shopify_customer_id.",
  },
  {
    source: "mindbody",
    file: "mindbody/booking_006_carol_repeat.json",
    note: "Repeat Mindbody booking for Carol (C).",
  },

  // Dana (D) — new customer, active on both sources.
  {
    source: "shopify",
    file: "shopify/order_009_dana.json",
    note: "Creates Customer D (Dana) — Shopify order with full signal set.",
  },
  {
    source: "mindbody",
    file: "mindbody/booking_007_dana.json",
    note: "Mindbody booking for Dana — email/phone match D.",
  },
  {
    source: "shopify",
    file: "shopify/order_010_dana_repeat.json",
    note: "Repeat Shopify order for Dana (D).",
  },
  {
    source: "mindbody",
    file: "mindbody/booking_008_dana_repeat.json",
    note: "Repeat Mindbody booking for Dana (D).",
  },

  // Evan (E) — new customer, both sources.
  {
    source: "shopify",
    file: "shopify/order_011_evan.json",
    note: "Creates Customer E (Evan) — high-value Shopify order.",
  },
  {
    source: "mindbody",
    file: "mindbody/booking_009_evan.json",
    note: "Mindbody booking for Evan — email/phone match E.",
  },

  // Fiona (F) — new customer, Shopify-only (bookingCount: 0).
  {
    source: "shopify",
    file: "shopify/order_012_fiona.json",
    note: "Creates Customer F (Fiona) — Shopify-only customer, no bookings.",
  },
  {
    source: "shopify",
    file: "shopify/order_013_fiona_repeat.json",
    note: "Repeat Shopify order for Fiona (F).",
  },

  // Greg (G) — new customer, Mindbody-only (orderCount: 0, $0 spend).
  {
    source: "mindbody",
    file: "mindbody/booking_010_greg.json",
    note: "Creates Customer G (Greg) — Mindbody-only customer, no orders.",
  },
  {
    source: "mindbody",
    file: "mindbody/booking_011_greg_repeat.json",
    note: "Repeat Mindbody booking for Greg (G).",
  },
];
