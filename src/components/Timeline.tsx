"use client";

import { Pane, Heading, Paragraph } from "evergreen-ui";
import type { CustomerView } from "@/lib/timeline";
import type { TimelineFilterValue } from "@/components/TimelineFilter";
import ShopifyOrderCard from "@/components/events/ShopifyOrderCard";
import MindbodyBookingCard from "@/components/events/MindbodyBookingCard";

interface TimelineProps {
  events: CustomerView["events"];
  filter: TimelineFilterValue;
}

function shouldShow(source: string, filter: TimelineFilterValue): boolean {
  if (filter === "orders") return source === "shopify";
  if (filter === "bookings") return source === "mindbody";
  return true;
}

export default function Timeline({ events, filter }: TimelineProps) {
  const visible = events.filter((e) => shouldShow(e.source, filter));

  return (
    <Pane marginY={16}>
      <Heading size={500} marginBottom={8}>
        Activity timeline ({visible.length} of {events.length})
      </Heading>
      {visible.length === 0 ? (
        <Paragraph color="muted">No events match this filter.</Paragraph>
      ) : (
        visible.map((event) => {
          if (event.source === "shopify") {
            return <ShopifyOrderCard key={event.id} event={event} />;
          }
          if (event.source === "mindbody") {
            return <MindbodyBookingCard key={event.id} event={event} />;
          }
          return null;
        })
      )}
    </Pane>
  );
}
