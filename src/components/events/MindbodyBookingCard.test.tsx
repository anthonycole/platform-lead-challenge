import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import MindbodyBookingCard from "./MindbodyBookingCard";
import { makeMindbodyEvent } from "../__test-utils__/fixtures";

describe("MindbodyBookingCard", () => {
  it("renders the class name and studio", () => {
    render(<MindbodyBookingCard event={makeMindbodyEvent()} />);
    expect(
      screen.getByText(/Reformer Pilates · Bondi/),
    ).toBeInTheDocument();
  });

  it("falls back to 'Booking' when no class name is in the payload", () => {
    render(
      <MindbodyBookingCard
        event={makeMindbodyEvent({
          payload: { id: "x", scheduled_at: "2026-05-12T07:00:00+10:00" },
        })}
      />,
    );
    expect(screen.getByRole("heading", { name: "Booking" })).toBeInTheDocument();
  });

  it("renders the scheduled-for line when scheduled_at is present", () => {
    render(<MindbodyBookingCard event={makeMindbodyEvent()} />);
    expect(screen.getByText(/Scheduled for/)).toBeInTheDocument();
  });

  it("omits the scheduled-for line when scheduled_at is missing", () => {
    render(
      <MindbodyBookingCard
        event={makeMindbodyEvent({
          payload: { id: "x", class_name: "Yoga" },
        })}
      />,
    );
    expect(screen.queryByText(/Scheduled for/)).not.toBeInTheDocument();
  });

  it("tolerates a null payload", () => {
    render(
      <MindbodyBookingCard event={makeMindbodyEvent({ payload: null })} />,
    );
    expect(screen.getByRole("heading", { name: "Booking" })).toBeInTheDocument();
  });

  it("renders the Mindbody source badge", () => {
    render(<MindbodyBookingCard event={makeMindbodyEvent()} />);
    expect(screen.getByText("Mindbody")).toBeInTheDocument();
    expect(screen.getByText(/booking\.created/)).toBeInTheDocument();
  });
});
