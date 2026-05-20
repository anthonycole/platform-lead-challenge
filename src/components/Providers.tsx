"use client";

import { useEffect, useState } from "react";
import { ThemeProvider, defaultTheme } from "evergreen-ui";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  return <ThemeProvider value={defaultTheme}>{children}</ThemeProvider>;
}
