import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import CustomerProfile from "./CustomerProfile";
import {
  makeCustomer,
  makeShopifyEvent,
  makeMindbodyEvent,
  makeSignal,
} from "./__test-utils__/fixtures";

describe("CustomerProfile", () => {
  it("renders the customer id and active status badge", () => {
    render(
      <CustomerProfile
        customer={makeCustomer({ id: "cus_XYZ", status: "active" })}
        signals={[]}
        events={[]}
      />,
    );
    expect(screen.getByText("cus_XYZ")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("renders merged status when the customer was merged away", () => {
    render(
      <CustomerProfile
        customer={makeCustomer({ status: "merged" })}
        signals={[]}
        events={[]}
      />,
    );
    expect(screen.getByText("merged")).toBeInTheDocument();
  });

  it("aggregates lifetime spend and counts from events", () => {
    const events = [
      makeShopifyEvent({ id: "a", payload: { id: "a", total_price: "100.00" } }),
      makeShopifyEvent({ id: "b", payload: { id: "b", total_price: "49.50" } }),
      makeMindbodyEvent({ id: "c" }),
    ];
    render(
      <CustomerProfile customer={makeCustomer()} signals={[]} events={events} />,
    );
    expect(screen.getByText(/\$150/)).toBeInTheDocument();
    expect(screen.getByText("2 orders · 1 booking")).toBeInTheDocument();
  });

  it("uses singular nouns for counts of one", () => {
    render(
      <CustomerProfile
        customer={makeCustomer()}
        signals={[]}
        events={[makeShopifyEvent()]}
      />,
    );
    expect(screen.getByText("1 order · 0 bookings")).toBeInTheDocument();
  });

  it("renders an em-dash when there is no activity", () => {
    render(
      <CustomerProfile
        customer={makeCustomer()}
        signals={[]}
        events={[]}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders an empty-signals message when none exist", () => {
    render(
      <CustomerProfile
        customer={makeCustomer()}
        signals={[]}
        events={[]}
      />,
    );
    expect(screen.getByText("No signals on this profile.")).toBeInTheDocument();
    expect(screen.getByText(/Identity signals \(0\)/)).toBeInTheDocument();
  });

  it("groups signals by type in the expected order", () => {
    const signals = [
      makeSignal({ type: "device_id", value: "dev_123" }),
      makeSignal({ type: "email", value: "jane@example.com" }),
      makeSignal({ type: "phone", value: "+61412345678" }),
    ];
    render(
      <CustomerProfile customer={makeCustomer()} signals={signals} events={[]} />,
    );

    const labels = screen
      .getAllByText(/Email|Phone|Device/, { selector: "span" })
      .map((el) => el.textContent);
    expect(labels.indexOf("Email")).toBeLessThan(labels.indexOf("Phone"));
    expect(labels.indexOf("Phone")).toBeLessThan(labels.indexOf("Device"));
  });

  it("flags probabilistic signals with a 'prob' badge", () => {
    const signals = [
      makeSignal({ type: "email", value: "jane@example.com" }),
      makeSignal({
        type: "phone",
        value: "+61412345678",
        confidence: "probabilistic",
      }),
    ];
    render(
      <CustomerProfile customer={makeCustomer()} signals={signals} events={[]} />,
    );
    const badges = screen.getAllByText("prob");
    expect(badges).toHaveLength(1);
  });

  it("shows the signal count in the section header", () => {
    const signals = [
      makeSignal({ type: "email", value: "a@a.com" }),
      makeSignal({ type: "email", value: "b@b.com" }),
      makeSignal({ type: "phone", value: "+61412345678" }),
    ];
    render(
      <CustomerProfile customer={makeCustomer()} signals={signals} events={[]} />,
    );
    expect(screen.getByText(/Identity signals \(3\)/)).toBeInTheDocument();
  });
});
