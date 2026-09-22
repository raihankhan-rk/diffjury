import { NextResponse } from "next/server";

import { getAnalyzeStats } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getAnalyzeStats());
}
