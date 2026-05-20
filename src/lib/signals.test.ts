import { describe, it, expect } from "vitest";
import {
  extractMindbodySignals,
  extractShopifySignals,
  normaliseSignal,
} from "./signals";
import type {
  MindbodyBookingPayload,
  ShopifyOrderPayload,
} from "@/types/webhooks";

describe("normaliseSignal", () => {
  it("lowercases and trims email", () => {
    expect(normaliseSignal("email", "  Jane.Doe@Example.COM ")).toBe(
      "jane.doe@example.com",
    );
  });

  it("strips whitespace from phone but preserves +", () => {
    expect(normaliseSignal("phone", "  +61 412 345 678 ")).toBe("+61412345678");
  });

  it("normalises AU-format phone variants to the same E.164 value", () => {
    const canonical = "+61412345678";
    expect(normaliseSignal("phone", "0412 345 678")).toBe(canonical);
    expect(normaliseSignal("phone", "(04) 1234-5678")).toBe(canonical);
    expect(normaliseSignal("phone", "0412-345-678")).toBe(canonical);
    expect(normaliseSignal("phone", "+61 (412) 345 678")).toBe(canonical);
    expect(normaliseSignal("phone", "61412345678")).toBe(canonical);
  });

  it("returns null for phone with no digits", () => {
    expect(normaliseSignal("phone", "  -- ")).toBeNull();
    expect(normaliseSignal("phone", "+")).toBeNull();
  });

  it("trims platform IDs and device_id without lowercasing", () => {
    expect(normaliseSignal("shopify_customer_id", " Cust_001 ")).toBe("Cust_001");
    expect(normaliseSignal("mindbody_client_id", " MB_001 ")).toBe("MB_001");
    expect(normaliseSignal("device_id", " Device_ABC ")).toBe("Device_ABC");
  });

  it("returns null for non-strings, empty, or whitespace-only", () => {
    expect(normaliseSignal("email", null)).toBeNull();
    expect(normaliseSignal("email", undefined)).toBeNull();
    expect(normaliseSignal("email", 42)).toBeNull();
    expect(normaliseSignal("email", "")).toBeNull();
    expect(normaliseSignal("email", "   ")).toBeNull();
  });
});

describe("extractShopifySignals", () => {
  const full: ShopifyOrderPayload = {
    id: "shopify_order_001",
    shopify_customer_id: "cust_shopify_001",
    email: "JANE.DOE@example.com",
    phone: "+61 412 345 678",
    device_id: "device_abc123",
    created_at: "2024-11-01T10:00:00Z",
  };

  it("extracts all four signal types from a complete payload", () => {
    const signals = extractShopifySignals(full);
    expect(signals).toEqual([
      { type: "email", value: "jane.doe@example.com", confidence: "deterministic" },
      { type: "phone", value: "+61412345678", confidence: "deterministic" },
      { type: "device_id", value: "device_abc123", confidence: "probabilistic" },
      { type: "shopify_customer_id", value: "cust_shopify_001", confidence: "deterministic" },
    ]);
  });

  it("skips null signals (guest checkout)", () => {
    const guest: ShopifyOrderPayload = {
      ...full,
      email: null,
      phone: null,
      shopify_customer_id: null,
    };
    const signals = extractShopifySignals(guest);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toEqual({
      type: "device_id",
      value: "device_abc123",
      confidence: "probabilistic",
    });
  });

  it("marks device_id as probabilistic and others as deterministic", () => {
    const signals = extractShopifySignals(full);
    const probabilistic = signals.filter((s) => s.confidence === "probabilistic");
    const deterministic = signals.filter((s) => s.confidence === "deterministic");
    expect(probabilistic.map((s) => s.type)).toEqual(["device_id"]);
    expect(deterministic.map((s) => s.type).sort()).toEqual(
      ["email", "phone", "shopify_customer_id"].sort(),
    );
  });
});

describe("extractMindbodySignals", () => {
  const booking: MindbodyBookingPayload = {
    id: "mb_booking_001",
    mindbody_client_id: "mb_client_001",
    client_email: "Jane.Doe@gmail.com",
    phone: "+61412345678",
    class_name: "Reformer Pilates",
    scheduled_at: "2024-11-05T08:00:00Z",
  };

  it("extracts email, phone, and mindbody_client_id", () => {
    const signals = extractMindbodySignals(booking);
    expect(signals).toEqual([
      { type: "email", value: "jane.doe@gmail.com", confidence: "deterministic" },
      { type: "phone", value: "+61412345678", confidence: "deterministic" },
      { type: "mindbody_client_id", value: "mb_client_001", confidence: "deterministic" },
    ]);
  });

  it("does not emit a device_id signal (none in the documented Mindbody payload)", () => {
    const signals = extractMindbodySignals(booking);
    expect(signals.find((s) => s.type === "device_id")).toBeUndefined();
  });

  it("skips null client_email and phone", () => {
    const signals = extractMindbodySignals({
      ...booking,
      client_email: null,
      phone: null,
    });
    expect(signals).toEqual([
      { type: "mindbody_client_id", value: "mb_client_001", confidence: "deterministic" },
    ]);
  });
});
