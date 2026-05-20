import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/timeline", () => ({
  searchCustomers: vi.fn(),
}));

import { GET } from "./route";
import { searchCustomers } from "@/lib/timeline";

const mockSearch = vi.mocked(searchCustomers);

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/customers/search${query}`);
}

describe("GET /api/customers/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty results without calling the lib when q is missing", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ results: [] });
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("returns empty results when q is whitespace only", async () => {
    const res = await GET(makeRequest("?q=%20%20"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ results: [] });
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("returns matched results for a multi result", async () => {
    const summaries = [
      {
        customerId: "cust_1",
        status: "active",
        matchedSignals: [{ type: "email", value: "jane@example.com" }],
        primaryEmail: "jane@example.com",
        primaryPhone: null,
        lastActivityAt: null,
      },
    ];
    mockSearch.mockResolvedValue({ kind: "multi", results: summaries });
    const res = await GET(makeRequest("?q=jane"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ results: summaries });
    expect(mockSearch).toHaveBeenCalledWith("jane");
  });

  it("returns empty results when the search yields none", async () => {
    mockSearch.mockResolvedValue({ kind: "none" });
    const res = await GET(makeRequest("?q=nobody"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ results: [] });
  });

  it("returns 500 when the search throws", async () => {
    mockSearch.mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("?q=jane"));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "internal error" });
  });
});
