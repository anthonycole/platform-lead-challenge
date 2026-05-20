"use client";

import Link from "next/link";
import { Pane, Heading, Text, Badge, Card, Paragraph } from "evergreen-ui";
import type { CustomerSummary } from "@/lib/timeline";
import { formatRelativeTime } from "@/lib/metrics";

interface CustomerResultsListProps {
  query: string;
  results: CustomerSummary[];
}

export default function CustomerResultsList({
  query,
  results,
}: CustomerResultsListProps) {
  return (
    <Pane>
      <Pane marginBottom={12}>
        <Heading size={500}>
          {results.length} {results.length === 1 ? "customer matches" : "customers match"} &ldquo;{query}&rdquo;
        </Heading>
        <Paragraph size={300} color="muted" marginTop={4}>
          Select a customer to view the full profile.
        </Paragraph>
      </Pane>
      <Pane display="flex" flexDirection="column" gap={8}>
        {results.map((r) => {
          return (
            <Link
              key={r.customerId}
              href={`/?customerId=${encodeURIComponent(r.customerId)}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Card
                elevation={1}
                hoverElevation={2}
                background="white"
                padding={16}
                borderRadius={8}
                display="flex"
                flexDirection="column"
                gap={6}
                cursor="pointer"
              >
                <Pane display="flex" alignItems="center" gap={8}>
                  <Text
                    fontFamily="mono"
                    size={300}
                    color="muted"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                  >
                    {r.customerId}
                  </Text>
                  {r.status !== "active" && (
                    <Badge color="orange">{r.status}</Badge>
                  )}
                </Pane>
                <Pane display="flex" flexDirection="column" gap={2}>
                  {r.primaryEmail && (
                    <Text size={400}>{r.primaryEmail}</Text>
                  )}
                  {r.primaryPhone && (
                    <Text size={300} color="muted">
                      {r.primaryPhone}
                    </Text>
                  )}
                </Pane>
                <Pane display="flex" gap={6} flexWrap="wrap">
                  {r.matchedSignals.map((s) => (
                    <Badge key={`${s.type}:${s.value}`} color="blue">
                      {s.type.replace(/_/g, " ")} match
                    </Badge>
                  ))}
                  {r.lastActivityAt && (
                    <Text size={300} color="muted" marginLeft={4}>
                      Last activity {formatRelativeTime(r.lastActivityAt)}
                    </Text>
                  )}
                </Pane>
              </Card>
            </Link>
          );
        })}
      </Pane>
    </Pane>
  );
}
