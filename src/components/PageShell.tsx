"use client";

import { Pane } from "evergreen-ui";

interface PageShellProps {
  appBar: React.ReactNode;
  sidebar?: React.ReactNode;
  main: React.ReactNode;
}

export default function PageShell({ appBar, sidebar, main }: PageShellProps) {
  return (
    <Pane minHeight="100vh" background="tint1">
      {appBar}
      <Pane
        display="grid"
        gridTemplateColumns={sidebar ? "1fr 320px" : "1fr"}
        gap={24}
        padding={24}
        maxWidth={1280}
        marginX="auto"
        width="100%"
      >
        <Pane display="flex" flexDirection="column" gap={16}>
          {main}
        </Pane>
        {sidebar && (
          <Pane
            position="sticky"
            top={88}
            alignSelf="start"
            display="flex"
            flexDirection="column"
            gap={16}
          >
            {sidebar}
          </Pane>
        )}
      </Pane>
    </Pane>
  );
}
