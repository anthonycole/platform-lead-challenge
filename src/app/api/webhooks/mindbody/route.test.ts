import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/resolver", () => ({
  resolveAndIngest: vi.fn(),
}));
vi.mock("@/lib/signals", () => ({
  extractMindbodySignals: vi.fn(() => [
    { type: "email", value: "jane@example.com", confidence: "deterministic" },
  ]),
}));

import { POST } from "./route";
import { resolveAndIngest } from "@/lib/resolver";

const mockIngest = vi.mocked(resolveAndIngest);

const validPayload = {
  id: "mb_booking_001",
  mindbody_client_id: "mb_client_001",
  client_email: "jane@example.com",
  phone: "+61412345678",
  class_name: "Reformer Pilates",
  scheduled_at: "2024-11-05T08:00:00Z",
};

function makeRequest(body: string): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/mindbody", {
    method: "POST",
    body,
  });
}

describe("POST /api/webhooks/mindbody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on invalid JSON", async () => {
    const res = await POST(makeRequest("not json"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid json" });
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("returns 400 with issues on a schema-invalid payload", async () => {
    const res = await POST(makeRequest(JSON.stringify({ id: "x" })));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid payload");
    expect(Array.isArray(json.issues)).toBe(true);
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("ingests a valid payload and returns 200", async () => {
    mockIngest.mockResolvedValue(undefined as never);
    const res = await POST(makeRequest(JSON.stringify(validPayload)));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });
    expect(mockIngest).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "mindbody",
        externalId: "mb_booking_001",
        eventType: "booking.created",
        occurredAt: new Date("2024-11-05T08:00:00Z"),
      }),
    );
  });

  it("returns 500 when ingestion throws", async () => {
    mockIngest.mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest(JSON.stringify(validPayload)));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "internal error" });
  });
});
