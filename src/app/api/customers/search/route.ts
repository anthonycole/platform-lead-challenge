import { NextRequest, NextResponse } from "next/server";
import { searchCustomers } from "@/lib/timeline";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = logger.child({ route: "customers/search", requestId });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const result = await searchCustomers(q);
    const results = result.kind === "multi" ? result.results : [];
    return NextResponse.json({ results });
  } catch (err) {
    log.error({ err, q }, "customer search failed");
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
