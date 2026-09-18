import { NextResponse } from "next/server";

import { runReview } from "@/lib/review";
import type { ReviewInput } from "@/lib/types";

export const runtime = "nodejs";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isMaxTokensExceeded(error: unknown): boolean {
  const details = [
    error instanceof Error ? error.message : String(error),
    typeof error === "object" && error !== null ? JSON.stringify(error) : "",
  ];
  return details.some((detail) => detail.includes("max_tokens_exceeded"));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = body as Partial<ReviewInput>;
  if (
    !isNonEmptyString(payload.title) ||
    !isNonEmptyString(payload.diff) ||
    typeof payload.body !== "string"
  ) {
    return NextResponse.json(
      { error: "title, body, and diff are required (title and diff non-empty)" },
      { status: 400 },
    );
  }

  const input: ReviewInput = {
    title: payload.title,
    body: payload.body,
    diff: payload.diff,
    ciLog: typeof payload.ciLog === "string" ? payload.ciLog : undefined,
    linkedIssue:
      typeof payload.linkedIssue === "string" ? payload.linkedIssue : undefined,
  };

  try {
    const result = await runReview(input);
    return NextResponse.json(result);
  } catch (error) {
    const message = isMaxTokensExceeded(error)
      ? "PR too large even after trimming"
      : error instanceof Error
        ? error.message
        : "Review failed";
    const status = message.includes("TYPESAFE_API_KEY") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
