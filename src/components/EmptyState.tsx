"use client";

import { Pane, Heading, Paragraph } from "evergreen-ui";

export default function EmptyState() {
  return (
    <Pane
      elevation={1}
      background="white"
      padding={32}
      borderRadius={8}
      marginY={24}
      textAlign="center"
    >
      <Heading size={500} marginBottom={8}>
        Search for a customer
      </Heading>
      <Paragraph color="muted">
        Try an email, phone number, device ID, Shopify customer ID, or Mindbody client ID.
      </Paragraph>
    </Pane>
  );
}
