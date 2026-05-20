"use client";

import { Alert, Pane } from "evergreen-ui";

export default function NotFoundState({ query }: { query: string }) {
  return (
    <Pane marginY={24}>
      <Alert
        intent="warning"
        title={`No customer matches "${query}"`}
      >
        We couldn&apos;t resolve that signal to a known customer. Double-check the
        value, or try a different identifier (email, phone, device ID, Shopify
        customer ID, or Mindbody client ID).
      </Alert>
    </Pane>
  );
}
