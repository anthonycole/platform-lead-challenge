"use client";

import { useEffect } from "react";
import { Pane, Alert, Button, Text } from "evergreen-ui";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("route error boundary caught:", error);
  }, [error]);

  return (
    <Pane padding={24} maxWidth={800} marginX="auto" width="100%">
      <Alert intent="danger" title="Something went wrong">
        <Text display="block" marginBottom={8}>
          {error.message || "An unexpected error occurred while loading this page."}
        </Text>
        {error.digest && (
          <Text size={300} color="muted" display="block" marginBottom={12}>
            Reference: {error.digest}
          </Text>
        )}
        <Button onClick={reset} appearance="primary" intent="danger">
          Try again
        </Button>
      </Alert>
    </Pane>
  );
}
