"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Pane, SearchInput, Button, Text, Badge, Spinner } from "evergreen-ui";
import type { CustomerSummary } from "@/lib/timeline";
import { formatRelativeTime } from "@/lib/metrics";

type SearchSummary = Omit<CustomerSummary, "lastActivityAt"> & {
  lastActivityAt: string | null;
};

function summaryLabel(item: SearchSummary): string {
  return item.primaryEmail ?? item.primaryPhone ?? item.customerId;
}

export default function SearchBar({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [items, setItems] = useState<SearchSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestSeq = useRef(0);

  // Debounced live search against /api/customers/search. We track the request
  // sequence so a slow response from an earlier keystroke can't clobber the
  // result of a later one.
  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      setItems([]);
      setLoading(false);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/customers/search?q=${encodeURIComponent(trimmed)}`,
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { results: SearchSummary[] };
        if (seq === requestSeq.current) {
          setItems(data.results ?? []);
          setHighlighted(-1);
        }
      } catch {
        if (seq === requestSeq.current) setItems([]);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 200);
    return () => window.clearTimeout(handle);
  }, [value]);

  // Close the dropdown when clicking outside the search bar.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    const params = new URLSearchParams(searchParams.toString());
    if (trimmed) {
      params.set("q", trimmed);
    } else {
      params.delete("q");
    }
    params.delete("customerId");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(false);
  };

  const handlePick = (item: SearchSummary) => {
    setOpen(false);
    router.push(`/?customerId=${encodeURIComponent(item.customerId)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      handlePick(items[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showDropdown = open && value.trim().length > 0;
  const hasResults = items.length > 0;

  return (
    <Pane ref={containerRef} position="relative">
      <form onSubmit={handleSubmit} aria-label="Search customers">
        <Pane display="flex" gap={8}>
          <SearchInput
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setValue(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search any customer identifier"
            aria-label="Search any customer identifier"
            width="100%"
            height={36}
          />
          <Button appearance="primary" type="submit" height={36}>
            Search
          </Button>
        </Pane>
      </form>

      {showDropdown && (
        <Pane
          role="listbox"
          aria-label="Live search results"
          position="absolute"
          top={42}
          left={0}
          right={88}
          background="white"
          elevation={2}
          borderRadius={6}
          maxHeight={360}
          overflowY="auto"
          zIndex={20}
          paddingY={4}
        >
          {loading && !hasResults && (
            <Pane padding={12} display="flex" alignItems="center" gap={8}>
              <Spinner size={14} />
              <Text size={300} color="muted">
                Searching…
              </Text>
            </Pane>
          )}
          {!loading && !hasResults && (
            <Pane padding={12}>
              <Text size={300} color="muted">
                No matches for &ldquo;{value.trim()}&rdquo;
              </Text>
            </Pane>
          )}
          {hasResults &&
            items.map((item, index) => (
              <Pane
                key={item.customerId}
                is="button"
                type="button"
                role="option"
                aria-selected={index === highlighted}
                onClick={() => handlePick(item)}
                onMouseEnter={() => setHighlighted(index)}
                width="100%"
                textAlign="left"
                border="none"
                cursor="pointer"
                background={index === highlighted ? "tint2" : "white"}
                paddingX={12}
                paddingY={8}
                display="flex"
                flexDirection="column"
                gap={2}
              >
                <Pane display="flex" alignItems="center" gap={8}>
                  <Text size={400}>{summaryLabel(item)}</Text>
                  {item.status !== "active" && (
                    <Badge color="orange">{item.status}</Badge>
                  )}
                </Pane>
                <Pane display="flex" alignItems="center" gap={6} flexWrap="wrap">
                  {item.matchedSignals.slice(0, 2).map((s) => (
                    <Badge key={`${s.type}:${s.value}`} color="blue">
                      {s.type.replace(/_/g, " ")} match
                    </Badge>
                  ))}
                  {item.lastActivityAt && (
                    <Text size={300} color="muted">
                      · {formatRelativeTime(new Date(item.lastActivityAt))}
                    </Text>
                  )}
                </Pane>
              </Pane>
            ))}
        </Pane>
      )}
    </Pane>
  );
}
