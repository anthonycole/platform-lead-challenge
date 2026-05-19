import { NextRequest, NextResponse } from "next/server";
import { getCustomerByQuery } from "@/lib/timeline";

export async function GET(req: NextRequest) {
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
    console.error("customer lookup error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
