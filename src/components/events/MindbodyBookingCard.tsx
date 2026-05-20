"use client";

import { Card, Pane, Badge, Heading, Text, Paragraph } from "evergreen-ui";
import type { CustomerView } from "@/lib/timeline";
import type { MindbodyBookingPayload } from "@/types";

interface MindbodyBookingCardProps {
  event: CustomerView["events"][number];
}

const formatter = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function MindbodyBookingCard({ event }: MindbodyBookingCardProps) {
  const payload = (event.payload ?? {}) as Partial<MindbodyBookingPayload>;
  const scheduledAt = payload.scheduled_at ? new Date(payload.scheduled_at) : null;
  return (
    <Card
      elevation={1}
      background="white"
      padding={16}
      borderRadius={8}
      marginBottom={12}
    >
      <Pane display="flex" alignItems="center" gap={8} marginBottom={8}>
        <Badge color="purple">Mindbody</Badge>
        <Text size={300} color="muted">
          booking.created · {formatter.format(event.occurredAt)}
        </Text>
      </Pane>
      <Heading size={500} marginBottom={4}>
        {payload.class_name ?? "Booking"}
        {payload.studio ? ` · ${payload.studio}` : null}
      </Heading>
      {scheduledAt && (
        <Paragraph size={300} color="muted">
          Scheduled for {formatter.format(scheduledAt)}
        </Paragraph>
      )}
    </Card>
  );
}
