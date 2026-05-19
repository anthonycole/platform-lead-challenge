import { NextRequest, NextResponse } from "next/server";
import { getCustomerByQuery } from "@/lib/timeline";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = logger.child({ route: "customers", requestId });

  const q = req.nextUrl.searchParams.get("q");
  if (!q || !q.trim()) {
    return NextResponse.json({ error: "missing q parameter" }, { status: 400 });
  }

  try {
    const view = await getCustomerByQuery(q);
    if (!view) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(view);
  } catch (err) {
    log.error({ err, q }, "customer lookup failed");
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
