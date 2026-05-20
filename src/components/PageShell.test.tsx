import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import PageShell from "./PageShell";

describe("PageShell", () => {
  it("renders app bar and main content", () => {
    render(
      <PageShell
        appBar={<div data-testid="bar">bar</div>}
        main={<div data-testid="main">main</div>}
      />,
    );
    expect(screen.getByTestId("bar")).toBeInTheDocument();
    expect(screen.getByTestId("main")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });

  it("renders sidebar when provided", () => {
    render(
      <PageShell
        appBar={<div>bar</div>}
        main={<div>main</div>}
        sidebar={<div data-testid="sidebar">side</div>}
      />,
    );
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });
});
