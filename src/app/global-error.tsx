"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          margin: 0,
          padding: "48px 24px",
          background: "#fafafa",
          color: "#171717",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            maxWidth: 640,
            margin: "0 auto",
            padding: 24,
            background: "white",
            border: "1px solid #e5e5e5",
            borderRadius: 8,
          }}
        >
          <h1 style={{ marginTop: 0, fontSize: 22 }}>Application error</h1>
          <p style={{ color: "#525252", lineHeight: 1.5 }}>
            {error.message || "The application failed to load."}
          </p>
          {error.digest && (
            <p style={{ color: "#737373", fontSize: 13 }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 12,
              padding: "8px 16px",
              fontSize: 14,
              background: "#1070ca",
              color: "white",
              border: 0,
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
