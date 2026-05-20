import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/timeline", () => ({
  getCustomerByQuery: vi.fn(),
}));

import { GET } from "./route";
import { getCustomerByQuery } from "@/lib/timeline";

const mockGetCustomer = vi.mocked(getCustomerByQuery);

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/customers${query}`);
}

describe("GET /api/customers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when q is missing", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "missing q parameter" });
    expect(mockGetCustomer).not.toHaveBeenCalled();
  });

  it("returns 400 when q is whitespace only", async () => {
    const res = await GET(makeRequest("?q=%20%20"));
    expect(res.status).toBe(400);
    expect(mockGetCustomer).not.toHaveBeenCalled();
  });

  it("returns 404 when no customer is found", async () => {
    mockGetCustomer.mockResolvedValue(null);
    const res = await GET(makeRequest("?q=jane@example.com"));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "not found" });
    expect(mockGetCustomer).toHaveBeenCalledWith("jane@example.com");
  });

  it("returns 200 with the customer view on success", async () => {
    const view = { customerId: "cust_1", events: [] } as never;
    mockGetCustomer.mockResolvedValue(view);
    const res = await GET(makeRequest("?q=cust_1"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ customerId: "cust_1", events: [] });
  });

  it("returns 500 when the lookup throws", async () => {
    mockGetCustomer.mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("?q=cust_1"));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "internal error" });
  });
});
