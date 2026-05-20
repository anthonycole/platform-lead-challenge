"use client";

import { Pane, Heading, Badge, Text, Paragraph, Tooltip } from "evergreen-ui";
import type { CustomerView } from "@/lib/timeline";
import {
  computeCustomerMetrics,
  formatCurrencyAUD,
  formatRelativeTime,
} from "@/lib/metrics";

interface CustomerProfileProps {
  customer: CustomerView["customer"];
  signals: CustomerView["signals"];
  events: CustomerView["events"];
}

const statusColor: Record<string, "green" | "orange" | "neutral"> = {
  active: "green",
  merged: "orange",
};

const SIGNAL_LABEL: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  shopify_customer_id: "Shopify ID",
  mindbody_client_id: "Mindbody ID",
  device_id: "Device",
};

const SIGNAL_ORDER = [
  "email",
  "phone",
  "shopify_customer_id",
  "mindbody_client_id",
  "device_id",
];

const dateFmt = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" });
const dateTimeFmt = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function CustomerProfile({
  customer,
  signals,
  events,
}: CustomerProfileProps) {
  const color = statusColor[customer.status] ?? "neutral";
  const metrics = computeCustomerMetrics(events);

  const grouped = new Map<string, CustomerView["signals"]>();
  for (const s of signals) {
    const list = grouped.get(s.type) ?? [];
    list.push(s);
    grouped.set(s.type, list);
  }
  const orderedTypes = SIGNAL_ORDER.filter((t) => grouped.has(t));

  return (
    <Pane elevation={1} background="white" padding={16} borderRadius={8}>
      <Pane display="flex" alignItems="center" justifyContent="space-between" marginBottom={8}>
        <Heading size={400}>Customer</Heading>
        <Badge color={color}>{customer.status}</Badge>
      </Pane>

      <Text
        size={300}
        fontFamily="mono"
        color="muted"
        display="block"
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
      >
        {customer.id}
      </Text>
      <Pane display="flex" flexDirection="column" gap={2} marginTop={4}>
        <Text size={300} color="muted">
          Created {dateFmt.format(customer.createdAt)}
        </Text>
        <Text size={300} color="muted">
          Updated {dateFmt.format(customer.updatedAt)}
        </Text>
      </Pane>

      <Pane borderTop="default" marginTop={16} paddingTop={16}>
        <Heading size={300} marginBottom={8}>
          Stats
        </Heading>
        <Pane display="flex" flexDirection="column" gap={6}>
          <Pane display="flex" justifyContent="space-between">
            <Text size={300} color="muted">Lifetime spend</Text>
            <Text size={300}>
              {formatCurrencyAUD(metrics.lifetimeSpendCents)}
            </Text>
          </Pane>
          <Pane display="flex" justifyContent="space-between">
            <Text size={300} color="muted">Activity</Text>
            <Text size={300}>
              {metrics.orderCount} order{metrics.orderCount === 1 ? "" : "s"}
              {" · "}
              {metrics.bookingCount} booking{metrics.bookingCount === 1 ? "" : "s"}
            </Text>
          </Pane>
          <Pane display="flex" justifyContent="space-between">
            <Text size={300} color="muted">Last activity</Text>
            <Text size={300}>
              {metrics.lastActivityAt
                ? formatRelativeTime(metrics.lastActivityAt)
                : "—"}
            </Text>
          </Pane>
        </Pane>
      </Pane>

      <Pane borderTop="default" marginTop={16} paddingTop={16}>
        <Heading size={300} marginBottom={8}>
          Identity signals ({signals.length})
        </Heading>
        {signals.length === 0 ? (
          <Paragraph size={300} color="muted">
            No signals on this profile.
          </Paragraph>
        ) : (
          <Pane display="flex" flexDirection="column" gap={12}>
            {orderedTypes.map((type) => (
              <Pane key={type}>
                <Text size={300} color="muted" textTransform="uppercase">
                  {SIGNAL_LABEL[type] ?? type}
                </Text>
                <Pane display="flex" flexDirection="column" gap={4} marginTop={4}>
                  {grouped.get(type)!.map((s) => (
                    <Tooltip
                      key={`${s.type}:${s.value}`}
                      id={`signal-tt-${s.type}-${encodeURIComponent(s.value)}`}
                      content={`First seen ${dateTimeFmt.format(s.firstSeenAt)} · Last seen ${dateTimeFmt.format(s.lastSeenAt)}`}
                    >
                      <Pane display="flex" alignItems="center" gap={6}>
                        <Text
                          size={300}
                          fontFamily="mono"
                          flex={1}
                          overflow="hidden"
                          textOverflow="ellipsis"
                          whiteSpace="nowrap"
                        >
                          {s.value}
                        </Text>
                        {s.confidence === "probabilistic" && (
                          <Badge color="yellow">prob</Badge>
                        )}
                      </Pane>
                    </Tooltip>
                  ))}
                </Pane>
              </Pane>
            ))}
          </Pane>
        )}
      </Pane>
    </Pane>
  );
}
