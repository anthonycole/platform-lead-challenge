"use client";

import { Card, Pane, Badge, Heading, Text, Paragraph } from "evergreen-ui";
import type { CustomerView } from "@/lib/timeline";
import type { ShopifyOrderPayload } from "@/types";

interface ShopifyOrderCardProps {
  event: CustomerView["events"][number];
}

const formatter = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function ShopifyOrderCard({ event }: ShopifyOrderCardProps) {
  const payload = (event.payload ?? {}) as Partial<ShopifyOrderPayload>;
  return (
    <Card
      elevation={1}
      background="white"
      padding={16}
      borderRadius={8}
      marginBottom={12}
    >
      <Pane display="flex" alignItems="center" gap={8} marginBottom={8}>
        <Badge color="blue">Shopify</Badge>
        <Text size={300} color="muted">
          order.created · {formatter.format(event.occurredAt)}
        </Text>
      </Pane>
      <Heading size={500} marginBottom={4}>
        Order {payload.id ?? event.externalId}
        {payload.total_price ? ` · $${payload.total_price}` : null}
      </Heading>
      {payload.line_items && payload.line_items.length > 0 ? (
        <Pane marginTop={4}>
          {payload.line_items.map((item, i) => (
            <Paragraph key={i} size={300} color="muted">
              {item.title} × {item.quantity}
            </Paragraph>
          ))}
        </Pane>
      ) : (
        <Paragraph size={300} color="muted">
          No line items recorded.
        </Paragraph>
      )}
    </Card>
  );
}
