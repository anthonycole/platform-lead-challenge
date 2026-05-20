"use client";

import { Pane, Heading } from "evergreen-ui";
import SearchBar from "@/components/SearchBar";

export default function AppBar({ initialQuery }: { initialQuery: string }) {
  return (
    <Pane
      position="sticky"
      top={0}
      zIndex={10}
      background="white"
      borderBottom="default"
      paddingY={12}
      paddingX={24}
      display="flex"
      alignItems="center"
      gap={24}
    >
      <Heading size={600} flexShrink={0}>
        KIC Customer Lookup
      </Heading>
      <Pane flex={1} maxWidth={640}>
        <SearchBar initialQuery={initialQuery} />
      </Pane>
    </Pane>
  );
}
