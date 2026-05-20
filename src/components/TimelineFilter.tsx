"use client";

import { Pane, Tablist, Tab } from "evergreen-ui";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type TimelineFilterValue = "all" | "orders" | "bookings";

const options: Array<{ label: string; value: TimelineFilterValue }> = [
  { label: "All", value: "all" },
  { label: "Orders", value: "orders" },
  { label: "Bookings", value: "bookings" },
];

export default function TimelineFilter({ active }: { active: TimelineFilterValue }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = (value: TimelineFilterValue) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("filter");
    } else {
      params.set("filter", value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <Pane marginY={12}>
      <Tablist>
        {options.map((opt) => (
          <Tab
            key={opt.value}
            isSelected={active === opt.value}
            onSelect={() => handleSelect(opt.value)}
          >
            {opt.label}
          </Tab>
        ))}
      </Tablist>
    </Pane>
  );
}
