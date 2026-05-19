import type { CustomerView } from "@/lib/timeline";
import type { ShopifyOrderPayload } from "@/types/webhooks";

export type CustomerMetrics = {
  orderCount: number;
  bookingCount: number;
  lifetimeSpendCents: number;
  lastActivityAt: Date | null;
};

// Derive ecommerce metrics from a customer's event log. Pure — no DB access.
// total_price arrives as a decimal string ("89.00") in the Shopify payload, so
// we parse defensively and store cents to avoid float drift across many orders.
export function computeCustomerMetrics(
  events: CustomerView["events"],
): CustomerMetrics {
  let orderCount = 0;
  let bookingCount = 0;
  let lifetimeSpendCents = 0;
  let lastActivityAt: Date | null = null;

  for (const event of events) {
    if (event.source === "shopify") {
      orderCount += 1;
      const payload = event.payload as Partial<ShopifyOrderPayload> | null;
      const cents = parsePriceToCents(payload?.total_price);
      if (cents !== null) lifetimeSpendCents += cents;
    } else if (event.source === "mindbody") {
      bookingCount += 1;
    }
    if (!lastActivityAt || event.occurredAt > lastActivityAt) {
      lastActivityAt = event.occurredAt;
    }
  }

  return { orderCount, bookingCount, lifetimeSpendCents, lastActivityAt };
}

function parsePriceToCents(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function formatCurrencyAUD(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// Coarse "time ago" formatter for the sidebar. Not internationalised — this is
// an internal tool. Falls back to an absolute date past 30 days.
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "just now";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(date);
}
